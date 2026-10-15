import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";

// This suite exercises the pure event-broadcast logic of the socket layer
// over a real, in-process Socket.io server/client pair on a local port. No
// Postgres is involved: all Prisma calls are mocked below, so persistence
// itself is not verified here (there is no DB available in this sandbox) —
// only that handlers call Prisma with the expected shape and broadcast the
// right events to the right sockets.
vi.mock("../config/prisma.js", () => ({
  prisma: {
    column: { findUnique: vi.fn() },
    card: { count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    comment: { create: vi.fn(), findMany: vi.fn() },
    activityLog: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}));
// Membership is checked (via board.service) before a socket may join a board
// room or mutate its cards. Every board in this suite is treated as one the
// connecting user already belongs to — the access-control behavior itself is
// covered separately in board.service.test.ts.
vi.mock("../services/board.service.js", () => ({
  isBoardMember: vi.fn().mockResolvedValue(true),
}));

const { prisma } = await import("../config/prisma.js");
const { isBoardMember } = await import("../services/board.service.js");
const { registerSocketHandlers } = await import("../sockets/index.js");

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let port: number;

function makeToken(id: string, name: string) {
  return jwt.sign({ id, name }, env.jwtSecret);
}

function connectClient(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      auth: token ? { token } : {},
      transports: ["websocket"],
      reconnection: false,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
}

function waitFor<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  registerSocketHandlers(io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(() => {
  io.close();
  httpServer.close();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("socket authentication", () => {
  it("rejects connections without a valid JWT", async () => {
    await expect(connectClient()).rejects.toBeTruthy();
  });

  it("accepts connections with a valid JWT", async () => {
    const socket = await connectClient(makeToken("u1", "Alice"));
    expect(socket.connected).toBe(true);
    socket.close();
  });
});

describe("board access control", () => {
  it("rejects board:join for a board the user isn't a member of", async () => {
    vi.mocked(isBoardMember).mockResolvedValueOnce(false);

    const alice = await connectClient(makeToken("u1", "Alice"));
    const errorEvent = waitFor<{ message: string }>(alice, "error");
    alice.emit("board:join", "someone-elses-board");

    await expect(errorEvent).resolves.toEqual({ message: "You don't have access to this board" });

    alice.close();
  });

  it("rejects card:create from a socket that hasn't joined the board", async () => {
    const alice = await connectClient(makeToken("u1", "Alice"));

    const errorEvent = waitFor<{ message: string }>(alice, "error");
    alice.emit("card:create", { boardId: "board-never-joined", columnId: "col-1", title: "Sneaky" });

    await expect(errorEvent).resolves.toEqual({ message: "Join the board before editing it" });
    expect(prisma.card.create).not.toHaveBeenCalled();

    alice.close();
  });
});

describe("presence", () => {
  it("sends presence:list to the joiner and presence:join to others already in the room", async () => {
    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-1");
    await waitFor(alice, "presence:list");

    const alicePresenceJoin = waitFor(alice, "presence:join");
    const bobPresenceList = waitFor<{ id: string; name: string }[]>(bob, "presence:list");
    bob.emit("board:join", "board-1");

    // presence:list reflects the full roster of the room, including the
    // joiner themselves (so the client can render it as-is).
    await expect(bobPresenceList).resolves.toEqual([
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ]);
    await expect(alicePresenceJoin).resolves.toEqual({ id: "u2", name: "Bob" });

    alice.close();
    bob.close();
  });

  it("broadcasts presence:leave to remaining members on disconnect", async () => {
    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-2");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-2");
    await waitFor(bob, "presence:list");

    const aliceLeave = waitFor(alice, "presence:leave");
    bob.close();

    await expect(aliceLeave).resolves.toEqual({ id: "u2", name: "Bob" });

    alice.close();
  });
});

describe("activity history", () => {
  it("sends the board's persisted activity log to a joining client", async () => {
    const createdAt = new Date();
    const entries = [
      { id: "act-1", boardId: "board-7", userId: "u1", message: "Alice created \"Card\"", createdAt },
    ];
    vi.mocked(prisma.activityLog.findMany).mockResolvedValueOnce(entries);

    const alice = await connectClient(makeToken("u1", "Alice"));

    const activityList = waitFor(alice, "activity:list");
    alice.emit("board:join", "board-7");

    // Dates cross the wire as ISO strings (Socket.io JSON-encodes payloads).
    await expect(activityList).resolves.toEqual([{ ...entries[0], createdAt: createdAt.toISOString() }]);
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith({
      where: { boardId: "board-7" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    alice.close();
  });
});

describe("card:create", () => {
  it("persists via Prisma, acks the sender, and broadcasts to other clients only", async () => {
    vi.mocked(prisma.column.findUnique).mockResolvedValue({
      id: "col-1",
      boardId: "board-3",
      name: "To Do",
      order: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.card.count).mockResolvedValue(0);
    vi.mocked(prisma.card.create).mockResolvedValue({
      id: "card-1",
      columnId: "col-1",
      title: "New card",
      description: null,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-1",
      boardId: "board-3",
      userId: "u1",
      message: 'Alice created "New card" in To Do',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-3");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-3");
    await waitFor(bob, "presence:list");

    const bobCardCreate = waitFor<{ id: string; title: string }>(bob, "card:create");
    const bobActivity = waitFor(bob, "activity:new");
    let aliceReceivedBroadcast = false;
    alice.once("card:create", () => {
      aliceReceivedBroadcast = true;
    });

    const ack = await new Promise((resolve) => {
      alice.emit(
        "card:create",
        { boardId: "board-3", columnId: "col-1", title: "New card" },
        resolve,
      );
    });

    expect(ack).toMatchObject({ id: "card-1", title: "New card" });
    await expect(bobCardCreate).resolves.toMatchObject({ id: "card-1", title: "New card" });
    await bobActivity;
    expect(aliceReceivedBroadcast).toBe(false);

    expect(prisma.card.create).toHaveBeenCalledWith({
      data: { columnId: "col-1", title: "New card", description: undefined, order: 0 },
    });

    alice.close();
    bob.close();
  });

  it("passes dueDate and labelColor through to Prisma", async () => {
    vi.mocked(prisma.column.findUnique).mockResolvedValue({
      id: "col-1",
      boardId: "board-3",
      name: "To Do",
      order: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.card.count).mockResolvedValue(0);
    vi.mocked(prisma.card.create).mockResolvedValue({
      id: "card-2",
      columnId: "col-1",
      title: "With due date",
      description: null,
      order: 0,
      dueDate: new Date("2026-12-01T00:00:00.000Z"),
      labelColor: "#e03131",
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-5",
      boardId: "board-3",
      userId: "u1",
      message: 'Alice created "With due date" in To Do',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-3");
    await waitFor(alice, "presence:list");

    await new Promise((resolve) => {
      alice.emit(
        "card:create",
        {
          boardId: "board-3",
          columnId: "col-1",
          title: "With due date",
          dueDate: "2026-12-01T00:00:00.000Z",
          labelColor: "#e03131",
        },
        resolve,
      );
    });

    expect(prisma.card.create).toHaveBeenCalledWith({
      data: {
        columnId: "col-1",
        title: "With due date",
        description: undefined,
        order: 0,
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
        labelColor: "#e03131",
      },
    });

    alice.close();
  });

  it("emits an error and skips persistence when the column does not belong to the board", async () => {
    vi.mocked(prisma.column.findUnique).mockResolvedValue({
      id: "col-1",
      boardId: "some-other-board",
      name: "To Do",
      order: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-4");
    await waitFor(alice, "presence:list");

    const errorEvent = waitFor(alice, "error");
    alice.emit("card:create", { boardId: "board-4", columnId: "col-1", title: "Nope" });

    await errorEvent;
    expect(prisma.card.create).not.toHaveBeenCalled();

    alice.close();
  });
});

describe("card:move", () => {
  it("persists and broadcasts to other clients only", async () => {
    vi.mocked(prisma.column.findUnique).mockResolvedValue({
      id: "col-2",
      boardId: "board-5",
      name: "Doing",
      order: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.card.update).mockResolvedValue({
      id: "card-9",
      columnId: "col-2",
      title: "Move me",
      description: null,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-2",
      boardId: "board-5",
      userId: "u1",
      message: 'Alice moved "Move me" to Doing',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-5");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-5");
    await waitFor(bob, "presence:list");

    const bobCardMove = waitFor<{ id: string; columnId: string; order: number }>(bob, "card:move");
    alice.emit("card:move", { boardId: "board-5", cardId: "card-9", columnId: "col-2", order: 2 });

    await expect(bobCardMove).resolves.toMatchObject({ id: "card-9", columnId: "col-2", order: 2 });
    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-9" },
      data: { columnId: "col-2", order: 2 },
    });

    alice.close();
    bob.close();
  });
});

describe("cursor:move", () => {
  it("broadcasts the position to other clients only, with no persistence", async () => {
    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-15");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-15");
    await waitFor(bob, "presence:list");

    const bobCursorMove = waitFor<{ userId: string; name: string; x: number; y: number }>(bob, "cursor:move");
    let aliceReceivedBroadcast = false;
    alice.once("cursor:move", () => {
      aliceReceivedBroadcast = true;
    });

    alice.emit("cursor:move", { boardId: "board-15", x: 0.5, y: 0.25 });

    await expect(bobCursorMove).resolves.toEqual({ userId: "u1", name: "Alice", x: 0.5, y: 0.25 });
    expect(aliceReceivedBroadcast).toBe(false);
    expect(prisma.card.update).not.toHaveBeenCalled();

    alice.close();
    bob.close();
  });

  it("rejects cursor:move from a socket that hasn't joined the board", async () => {
    const alice = await connectClient(makeToken("u1", "Alice"));

    const errorEvent = waitFor<{ message: string }>(alice, "error");
    alice.emit("cursor:move", { boardId: "board-never-joined", x: 0.1, y: 0.1 });

    await expect(errorEvent).resolves.toEqual({ message: "Join the board before editing it" });

    alice.close();
  });
});

describe("card:update", () => {
  it("updates title/description and broadcasts to other clients only", async () => {
    vi.mocked(prisma.card.update).mockResolvedValue({
      id: "card-10",
      columnId: "col-1",
      title: "Renamed",
      description: "New description",
      order: 0,
      dueDate: null,
      labelColor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-6",
      boardId: "board-11",
      userId: "u1",
      message: 'Alice updated "Renamed"',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-11");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-11");
    await waitFor(bob, "presence:list");

    const bobCardUpdate = waitFor<{ id: string; title: string }>(bob, "card:update");
    alice.emit("card:update", {
      boardId: "board-11",
      cardId: "card-10",
      title: "Renamed",
      description: "New description",
    });

    await expect(bobCardUpdate).resolves.toMatchObject({ id: "card-10", title: "Renamed" });
    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-10" },
      data: { title: "Renamed", description: "New description" },
    });

    alice.close();
    bob.close();
  });

  it("sets a due date and label color without touching title/description", async () => {
    vi.mocked(prisma.card.update).mockResolvedValue({
      id: "card-12",
      columnId: "col-1",
      title: "Existing",
      description: null,
      order: 0,
      dueDate: new Date("2026-12-01T00:00:00.000Z"),
      labelColor: "#2f9e44",
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-7",
      boardId: "board-12",
      userId: "u1",
      message: 'Alice updated "Existing"',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-12");
    await waitFor(alice, "presence:list");

    alice.emit("card:update", {
      boardId: "board-12",
      cardId: "card-12",
      dueDate: "2026-12-01T00:00:00.000Z",
      labelColor: "#2f9e44",
    });
    await waitFor(alice, "activity:new");

    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-12" },
      data: { dueDate: new Date("2026-12-01T00:00:00.000Z"), labelColor: "#2f9e44" },
    });

    alice.close();
  });

  it("clears a due date and label color with an explicit null", async () => {
    vi.mocked(prisma.card.update).mockResolvedValue({
      id: "card-13",
      columnId: "col-1",
      title: "Existing",
      description: null,
      order: 0,
      dueDate: null,
      labelColor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-8",
      boardId: "board-13",
      userId: "u1",
      message: 'Alice updated "Existing"',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-13");
    await waitFor(alice, "presence:list");

    alice.emit("card:update", { boardId: "board-13", cardId: "card-13", dueDate: null, labelColor: null });
    await waitFor(alice, "activity:new");

    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: "card-13" },
      data: { dueDate: null, labelColor: null },
    });

    alice.close();
  });

  it("rejects a payload with none of title, description, dueDate, or labelColor", async () => {
    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-14");
    await waitFor(alice, "presence:list");

    const errorEvent = waitFor(alice, "error");
    alice.emit("card:update", { boardId: "board-14", cardId: "card-14" });

    await errorEvent;
    expect(prisma.card.update).not.toHaveBeenCalled();

    alice.close();
  });
});

describe("comment:create", () => {
  it("persists via Prisma, acks the sender, and broadcasts to other clients only", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.card.findUnique).mockResolvedValue({ title: "Discuss this" } as any);
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: "comment-1",
      cardId: "card-1",
      authorId: "u1",
      authorName: "Alice",
      body: "Looks good",
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-4",
      boardId: "board-8",
      userId: "u1",
      message: 'Alice commented on "Discuss this"',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-8");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-8");
    await waitFor(bob, "presence:list");

    const bobCommentCreate = waitFor<{ id: string; body: string }>(bob, "comment:create");
    const bobActivity = waitFor(bob, "activity:new");
    let aliceReceivedBroadcast = false;
    alice.once("comment:create", () => {
      aliceReceivedBroadcast = true;
    });

    const ack = await new Promise((resolve) => {
      alice.emit("comment:create", { boardId: "board-8", cardId: "card-1", body: "Looks good" }, resolve);
    });

    expect(ack).toMatchObject({ id: "comment-1", body: "Looks good" });
    await expect(bobCommentCreate).resolves.toMatchObject({ id: "comment-1", body: "Looks good" });
    await bobActivity;
    expect(aliceReceivedBroadcast).toBe(false);

    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: { cardId: "card-1", authorId: "u1", authorName: "Alice", body: "Looks good" },
    });

    alice.close();
    bob.close();
  });

  it("emits an error and skips persistence when the card doesn't exist", async () => {
    vi.mocked(prisma.card.findUnique).mockResolvedValue(null);

    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-9");
    await waitFor(alice, "presence:list");

    const errorEvent = waitFor(alice, "error");
    alice.emit("comment:create", { boardId: "board-9", cardId: "missing-card", body: "Hello" });

    await errorEvent;
    expect(prisma.comment.create).not.toHaveBeenCalled();

    alice.close();
  });
});

describe("comment:list", () => {
  it("acks the caller with the card's comments, oldest first", async () => {
    const createdAt = new Date();
    const comments = [
      { id: "comment-1", cardId: "card-1", authorId: "u2", authorName: "Bob", body: "First", createdAt },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.comment.findMany).mockResolvedValue(comments as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    alice.emit("board:join", "board-10");
    await waitFor(alice, "presence:list");

    const ack = await new Promise((resolve) => {
      alice.emit("comment:list", { boardId: "board-10", cardId: "card-1" }, resolve);
    });

    expect(ack).toMatchObject([{ id: "comment-1", body: "First" }]);
    expect(prisma.comment.findMany).toHaveBeenCalledWith({
      where: { cardId: "card-1" },
      orderBy: { createdAt: "asc" },
    });

    alice.close();
  });
});

describe("card:delete", () => {
  it("persists and broadcasts { id, columnId } to other clients only", async () => {
    vi.mocked(prisma.card.delete).mockResolvedValue({
      id: "card-7",
      columnId: "col-1",
      title: "Bye",
      description: null,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prisma.activityLog.create).mockResolvedValue({
      id: "act-3",
      boardId: "board-6",
      userId: "u1",
      message: 'Alice deleted "Bye"',
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const alice = await connectClient(makeToken("u1", "Alice"));
    const bob = await connectClient(makeToken("u2", "Bob"));

    alice.emit("board:join", "board-6");
    await waitFor(alice, "presence:list");
    bob.emit("board:join", "board-6");
    await waitFor(bob, "presence:list");

    const bobCardDelete = waitFor(bob, "card:delete");
    alice.emit("card:delete", { boardId: "board-6", cardId: "card-7" });

    await expect(bobCardDelete).resolves.toEqual({ id: "card-7", columnId: "col-1" });

    alice.close();
    bob.close();
  });
});

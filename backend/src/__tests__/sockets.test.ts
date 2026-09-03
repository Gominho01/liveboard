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
    card: { count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    activityLog: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { prisma } = await import("../config/prisma.js");
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

import jwt from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import {
  boardJoinSchema,
  cardCreateSchema,
  cardDeleteSchema,
  cardMoveSchema,
  cardUpdateSchema,
} from "./schemas.js";

interface SocketUser {
  id: string;
  name: string;
}

// boardId -> (socketId -> user). In-memory presence tracking; fine for a
// single-process phase-1 deployment.
const boardPresence = new Map<string, Map<string, SocketUser>>();
// socketId -> set of boardIds the socket has joined, so disconnect can clean
// up presence in every room the socket was part of.
const socketBoards = new Map<string, Set<string>>();

function boardRoom(boardId: string): string {
  return `board:${boardId}`;
}

function getPresenceList(boardId: string): SocketUser[] {
  const presence = boardPresence.get(boardId);
  return presence ? Array.from(presence.values()) : [];
}

function addPresence(boardId: string, socket: Socket, user: SocketUser): void {
  if (!boardPresence.has(boardId)) {
    boardPresence.set(boardId, new Map());
  }
  boardPresence.get(boardId)!.set(socket.id, user);

  if (!socketBoards.has(socket.id)) {
    socketBoards.set(socket.id, new Set());
  }
  socketBoards.get(socket.id)!.add(boardId);
}

function removePresence(boardId: string, socketId: string): void {
  const presence = boardPresence.get(boardId);
  presence?.delete(socketId);
  if (presence?.size === 0) {
    boardPresence.delete(boardId);
  }
}

async function logActivity(boardId: string, user: SocketUser, message: string) {
  return prisma.activityLog.create({
    data: { boardId, userId: user.id, message },
  });
}

export function registerSocketHandlers(io: Server): void {
  // Reject the handshake outright if the JWT is missing/invalid.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("unauthorized"));
      return;
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret) as SocketUser;
      socket.data.user = { id: payload.id, name: payload.name };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    socket.on("board:join", async (rawBoardId: unknown) => {
      const parsed = boardJoinSchema.safeParse(rawBoardId);
      if (!parsed.success) {
        socket.emit("error", { message: "Invalid boardId" });
        return;
      }
      const boardId = parsed.data;

      socket.join(boardRoom(boardId));
      addPresence(boardId, socket, user);

      // Others in the room learn this user joined...
      socket.to(boardRoom(boardId)).emit("presence:join", user);
      // ...and the joiner gets the current roster (including themselves).
      socket.emit("presence:list", getPresenceList(boardId));

      // Activity is persisted (see logActivity below) but only ever
      // broadcast live — send the recent history so a returning user
      // doesn't see an empty feed.
      const history = await prisma.activityLog.findMany({
        where: { boardId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      socket.emit("activity:list", history);
    });

    socket.on("card:create", async (payload: unknown, callback?: (card: unknown) => void) => {
      const parsed = cardCreateSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: "Invalid card:create payload" });
        return;
      }
      const { boardId, columnId, title, description } = parsed.data;

      try {
        const column = await prisma.column.findUnique({ where: { id: columnId } });
        if (!column || column.boardId !== boardId) {
          socket.emit("error", { message: "Column not found on this board" });
          return;
        }

        const order = await prisma.card.count({ where: { columnId } });
        const card = await prisma.card.create({
          data: { columnId, title, description, order },
        });

        // The sender gets the persisted card via the ack callback (it has no
        // client-generated id to apply optimistically); everyone else gets
        // it via the room broadcast.
        callback?.(card);
        socket.to(boardRoom(boardId)).emit("card:create", card);

        const activity = await logActivity(boardId, user, `${user.name} created "${title}" in ${column.name}`);
        io.to(boardRoom(boardId)).emit("activity:new", activity);
      } catch (err) {
        console.error("card:create failed", err);
        socket.emit("error", { message: "Failed to create card" });
      }
    });

    socket.on("card:move", async (payload: unknown) => {
      const parsed = cardMoveSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: "Invalid card:move payload" });
        return;
      }
      const { boardId, cardId, columnId, order } = parsed.data;

      try {
        const column = await prisma.column.findUnique({ where: { id: columnId } });
        if (!column || column.boardId !== boardId) {
          socket.emit("error", { message: "Column not found on this board" });
          return;
        }

        const card = await prisma.card.update({
          where: { id: cardId },
          data: { columnId, order },
        });

        socket.to(boardRoom(boardId)).emit("card:move", card);

        const activity = await logActivity(boardId, user, `${user.name} moved "${card.title}" to ${column.name}`);
        io.to(boardRoom(boardId)).emit("activity:new", activity);
      } catch (err) {
        console.error("card:move failed", err);
        socket.emit("error", { message: "Failed to move card" });
      }
    });

    socket.on("card:update", async (payload: unknown) => {
      const parsed = cardUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: "Invalid card:update payload" });
        return;
      }
      const { boardId, cardId, title, description } = parsed.data;

      try {
        const card = await prisma.card.update({
          where: { id: cardId },
          data: {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
          },
        });

        socket.to(boardRoom(boardId)).emit("card:update", card);

        const activity = await logActivity(boardId, user, `${user.name} updated "${card.title}"`);
        io.to(boardRoom(boardId)).emit("activity:new", activity);
      } catch (err) {
        console.error("card:update failed", err);
        socket.emit("error", { message: "Failed to update card" });
      }
    });

    socket.on("card:delete", async (payload: unknown) => {
      const parsed = cardDeleteSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", { message: "Invalid card:delete payload" });
        return;
      }
      const { boardId, cardId } = parsed.data;

      try {
        const card = await prisma.card.delete({ where: { id: cardId } });

        socket.to(boardRoom(boardId)).emit("card:delete", { id: card.id, columnId: card.columnId });

        const activity = await logActivity(boardId, user, `${user.name} deleted "${card.title}"`);
        io.to(boardRoom(boardId)).emit("activity:new", activity);
      } catch (err) {
        console.error("card:delete failed", err);
        socket.emit("error", { message: "Failed to delete card" });
      }
    });

    socket.on("disconnect", () => {
      const boards = socketBoards.get(socket.id);
      if (!boards) return;

      for (const boardId of boards) {
        removePresence(boardId, socket.id);
        socket.to(boardRoom(boardId)).emit("presence:leave", user);
      }
      socketBoards.delete(socket.id);
    });
  });
}

import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

const DEFAULT_COLUMNS = ["To Do", "Doing", "Done"];

const boardInclude = {
  columns: {
    orderBy: { order: "asc" as const },
    include: {
      cards: {
        orderBy: { order: "asc" as const },
      },
    },
  },
};

export interface BoardSummary {
  id: string;
  name: string;
  role: "OWNER" | "MEMBER";
  createdAt: Date;
}

/** Every board a user belongs to, owned or invited into, newest first. */
export async function listBoardsForUser(userId: string): Promise<BoardSummary[]> {
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    include: { board: true },
    orderBy: { board: { createdAt: "desc" } },
  });

  return memberships.map((membership) => ({
    id: membership.board.id,
    name: membership.board.name,
    role: membership.role as "OWNER" | "MEMBER",
    createdAt: membership.board.createdAt,
  }));
}

/** Creates a board owned by `userId`, with the fixed 3-column layout, and
 * makes the creator its first (OWNER) member. */
export async function createBoard(userId: string, name: string) {
  return prisma.board.create({
    data: {
      name,
      ownerId: userId,
      columns: {
        create: DEFAULT_COLUMNS.map((columnName, order) => ({ name: columnName, order })),
      },
      members: {
        create: { userId, role: "OWNER" },
      },
    },
    include: boardInclude,
  });
}

async function requireMembership(userId: string, boardId: string) {
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  if (!membership) {
    // 404 rather than 403 — a non-member shouldn't learn the board exists.
    throw new AppError(404, "Board not found");
  }
  return membership;
}

/** Whether `userId` may read/join `boardId` — used by the socket layer,
 * which can't rely on thrown errors the same way HTTP handlers do. */
export async function isBoardMember(userId: string, boardId: string): Promise<boolean> {
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  return membership !== null;
}

export async function getBoardForUser(userId: string, boardId: string) {
  await requireMembership(userId, boardId);

  const board = await prisma.board.findUnique({ where: { id: boardId }, include: boardInclude });
  if (!board) {
    throw new AppError(404, "Board not found");
  }
  return board;
}

async function requireOwner(userId: string, boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) {
    throw new AppError(404, "Board not found");
  }
  if (board.ownerId !== userId) {
    throw new AppError(403, "Only the board owner can do this");
  }
  return board;
}

export async function getInviteToken(userId: string, boardId: string): Promise<string> {
  const board = await requireOwner(userId, boardId);
  return board.inviteToken;
}

/** Issues a fresh token, invalidating whatever link was shared before. */
export async function regenerateInviteToken(userId: string, boardId: string): Promise<string> {
  await requireOwner(userId, boardId);
  const board = await prisma.board.update({
    where: { id: boardId },
    data: { inviteToken: randomUUID() },
  });
  return board.inviteToken;
}

/** Joining via an invite link is idempotent — visiting a link you already
 * used (or your own board's link) just takes you to the board. */
export async function acceptInvite(userId: string, token: string) {
  const board = await prisma.board.findUnique({ where: { inviteToken: token } });
  if (!board) {
    throw new AppError(404, "Invite link is invalid or has been revoked");
  }

  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: board.id, userId } },
    create: { boardId: board.id, userId, role: "MEMBER" },
    update: {},
  });

  return prisma.board.findUnique({ where: { id: board.id }, include: boardInclude });
}

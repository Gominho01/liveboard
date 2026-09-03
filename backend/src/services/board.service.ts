import { prisma } from "../config/prisma.js";

const DEFAULT_BOARD_NAME = "Default Board";
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

/**
 * Phase 1 assumes a single shared board for every logged-in user. Returns the
 * default board (creating it, with its 3 fixed columns, on first call).
 */
export async function getDefaultBoard(requestingUserId: string) {
  const existing = await prisma.board.findFirst({
    orderBy: { createdAt: "asc" },
    include: boardInclude,
  });

  if (existing) {
    return existing;
  }

  return prisma.board.create({
    data: {
      name: DEFAULT_BOARD_NAME,
      ownerId: requestingUserId,
      columns: {
        create: DEFAULT_COLUMNS.map((name, order) => ({ name, order })),
      },
    },
    include: boardInclude,
  });
}

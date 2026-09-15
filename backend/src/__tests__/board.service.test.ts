import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/prisma.js", () => ({
  prisma: {
    board: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    boardMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import("../config/prisma.js");
const {
  acceptInvite,
  createBoard,
  deleteBoard,
  getBoardForUser,
  getInviteToken,
  isBoardMember,
  leaveBoard,
  listBoardsForUser,
  regenerateInviteToken,
} = await import("../services/board.service.js");
const { AppError } = await import("../utils/app-error.js");

describe("board service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listBoardsForUser", () => {
    it("returns every board the user is a member of, with their role", async () => {
      vi.mocked(prisma.boardMember.findMany).mockResolvedValue([
        {
          role: "OWNER",
          board: { id: "board-1", name: "My Board", createdAt: new Date("2026-01-01") },
        },
        {
          role: "MEMBER",
          board: { id: "board-2", name: "Shared Board", createdAt: new Date("2026-02-01") },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any);

      const result = await listBoardsForUser("user-1");

      expect(result).toEqual([
        { id: "board-1", name: "My Board", role: "OWNER", createdAt: new Date("2026-01-01") },
        { id: "board-2", name: "Shared Board", role: "MEMBER", createdAt: new Date("2026-02-01") },
      ]);
    });
  });

  describe("createBoard", () => {
    it("creates the board with the fixed columns and the creator as OWNER", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.create).mockResolvedValue({ id: "board-1", name: "New Board" } as any);

      await createBoard("user-1", "New Board");

      expect(prisma.board.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "New Board",
            ownerId: "user-1",
            columns: { create: [{ name: "To Do", order: 0 }, { name: "Doing", order: 1 }, { name: "Done", order: 2 }] },
            members: { create: { userId: "user-1", role: "OWNER" } },
          }),
        }),
      );
    });
  });

  describe("getBoardForUser", () => {
    it("returns the board for a member", async () => {
      vi.mocked(prisma.boardMember.findUnique).mockResolvedValue({
        id: "mem-1",
        boardId: "board-1",
        userId: "user-1",
        role: "MEMBER",
        joinedAt: new Date(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", name: "My Board" } as any);

      const board = await getBoardForUser("user-1", "board-1");

      expect(board).toEqual({ id: "board-1", name: "My Board" });
    });

    it("throws a 404 for a non-member, without revealing whether the board exists", async () => {
      vi.mocked(prisma.boardMember.findUnique).mockResolvedValue(null);

      const promise = getBoardForUser("user-1", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 404 });
      expect(prisma.board.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("isBoardMember", () => {
    it("returns true when a membership row exists", async () => {
      vi.mocked(prisma.boardMember.findUnique).mockResolvedValue({
        id: "mem-1",
        boardId: "board-1",
        userId: "user-1",
        role: "MEMBER",
        joinedAt: new Date(),
      });

      await expect(isBoardMember("user-1", "board-1")).resolves.toBe(true);
    });

    it("returns false when there is none", async () => {
      vi.mocked(prisma.boardMember.findUnique).mockResolvedValue(null);

      await expect(isBoardMember("user-1", "board-1")).resolves.toBe(false);
    });
  });

  describe("getInviteToken / regenerateInviteToken", () => {
    it("returns the board's invite token for its owner", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "user-1", inviteToken: "tok-1" } as any);

      await expect(getInviteToken("user-1", "board-1")).resolves.toBe("tok-1");
    });

    it("rejects a non-owner with a 403", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "someone-else", inviteToken: "tok-1" } as any);

      const promise = getInviteToken("user-1", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 403 });
    });

    it("regenerating issues a new token, different from the old one", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "user-1", inviteToken: "old-tok" } as any);
      vi.mocked(prisma.board.update).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (async ({ data }: any) => ({ id: "board-1", ownerId: "user-1", inviteToken: data.inviteToken })) as any,
      );

      const newToken = await regenerateInviteToken("user-1", "board-1");

      expect(newToken).not.toBe("old-tok");
    });
  });

  describe("acceptInvite", () => {
    it("adds the accepting user as a MEMBER and returns the board", async () => {
      vi.mocked(prisma.board.findUnique)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ id: "board-1", ownerId: "owner-1", inviteToken: "tok-1" } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce({ id: "board-1", name: "Shared Board" } as any);

      const board = await acceptInvite("user-2", "tok-1");

      expect(prisma.boardMember.upsert).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: "board-1", userId: "user-2" } },
        create: { boardId: "board-1", userId: "user-2", role: "MEMBER" },
        update: {},
      });
      expect(board).toEqual({ id: "board-1", name: "Shared Board" });
    });

    it("throws a 404 for an unknown or revoked token", async () => {
      vi.mocked(prisma.board.findUnique).mockResolvedValue(null);

      const promise = acceptInvite("user-2", "bad-token");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 404 });
      expect(prisma.boardMember.upsert).not.toHaveBeenCalled();
    });
  });

  describe("leaveBoard", () => {
    it("removes the membership row for a non-owner member", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "owner-1" } as any);
      vi.mocked(prisma.boardMember.findUnique).mockResolvedValue({
        id: "mem-1",
        boardId: "board-1",
        userId: "user-2",
        role: "MEMBER",
        joinedAt: new Date(),
      });

      await leaveBoard("user-2", "board-1");

      expect(prisma.boardMember.delete).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: "board-1", userId: "user-2" } },
      });
    });

    it("rejects the owner trying to leave their own board", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "user-1" } as any);

      const promise = leaveBoard("user-1", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 400 });
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it("throws a 404 for a board that doesn't exist", async () => {
      vi.mocked(prisma.board.findUnique).mockResolvedValue(null);

      const promise = leaveBoard("user-2", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 404 });
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });

    it("throws a 404 for a user who isn't a member", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "owner-1" } as any);
      vi.mocked(prisma.boardMember.findUnique).mockResolvedValue(null);

      const promise = leaveBoard("user-2", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 404 });
      expect(prisma.boardMember.delete).not.toHaveBeenCalled();
    });
  });

  describe("deleteBoard", () => {
    it("deletes the board for its owner, even with other members in it", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "user-1" } as any);

      await deleteBoard("user-1", "board-1");

      expect(prisma.board.delete).toHaveBeenCalledWith({ where: { id: "board-1" } });
    });

    it("rejects a non-owner", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.board.findUnique).mockResolvedValue({ id: "board-1", ownerId: "owner-1" } as any);

      const promise = deleteBoard("user-2", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 403 });
      expect(prisma.board.delete).not.toHaveBeenCalled();
    });

    it("throws a 404 for a board that doesn't exist", async () => {
      vi.mocked(prisma.board.findUnique).mockResolvedValue(null);

      const promise = deleteBoard("user-1", "board-1");
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({ status: 404 });
      expect(prisma.board.delete).not.toHaveBeenCalled();
    });
  });
});

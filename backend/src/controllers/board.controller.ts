import type { Request, Response } from "express";
import { z } from "zod";
import {
  acceptInvite,
  createBoard,
  getBoardForUser,
  getInviteToken,
  listBoardsForUser,
  regenerateInviteToken,
} from "../services/board.service.js";
import { AppError } from "../utils/app-error.js";

const createBoardSchema = z.object({
  name: z.string().min(1).max(80),
});

function handleError(err: unknown, res: Response): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  throw err;
}

export async function listBoardsHandler(req: Request, res: Response): Promise<void> {
  const boards = await listBoardsForUser(req.user!.id);
  res.json(boards);
}

export async function createBoardHandler(req: Request, res: Response): Promise<void> {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    return;
  }

  const board = await createBoard(req.user!.id, parsed.data.name);
  res.status(201).json(board);
}

export async function getBoardHandler(req: Request, res: Response): Promise<void> {
  try {
    const board = await getBoardForUser(req.user!.id, req.params.id as string);
    res.json(board);
  } catch (err) {
    handleError(err, res);
  }
}

export async function getInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const token = await getInviteToken(req.user!.id, req.params.id as string);
    res.json({ token });
  } catch (err) {
    handleError(err, res);
  }
}

export async function regenerateInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const token = await regenerateInviteToken(req.user!.id, req.params.id as string);
    res.json({ token });
  } catch (err) {
    handleError(err, res);
  }
}

export async function acceptInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const board = await acceptInvite(req.user!.id, req.params.token as string);
    res.json(board);
  } catch (err) {
    handleError(err, res);
  }
}

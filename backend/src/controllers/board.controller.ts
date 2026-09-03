import type { Request, Response } from "express";
import { getDefaultBoard } from "../services/board.service.js";

export async function getDefaultBoardHandler(req: Request, res: Response): Promise<void> {
  // `authenticate` middleware guarantees req.user is set before this runs.
  const board = await getDefaultBoard(req.user!.id);
  res.json(board);
}

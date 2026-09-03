import { z } from "zod";

export const boardJoinSchema = z.string().min(1);

export const cardCreateSchema = z.object({
  boardId: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const cardMoveSchema = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
  columnId: z.string().min(1),
  order: z.number().int().nonnegative(),
});

export const cardUpdateSchema = z
  .object({
    boardId: z.string().min(1),
    cardId: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: "At least one of title or description must be provided",
  });

export const cardDeleteSchema = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
});

export type CardCreatePayload = z.infer<typeof cardCreateSchema>;
export type CardMovePayload = z.infer<typeof cardMoveSchema>;
export type CardUpdatePayload = z.infer<typeof cardUpdateSchema>;
export type CardDeletePayload = z.infer<typeof cardDeleteSchema>;

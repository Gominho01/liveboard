import { z } from "zod";

export const boardJoinSchema = z.string().min(1);

const dueDateSchema = z.string().datetime().nullable().optional();
const labelColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

export const cardCreateSchema = z.object({
  boardId: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: dueDateSchema,
  labelColor: labelColorSchema,
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
    dueDate: dueDateSchema,
    labelColor: labelColorSchema,
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.dueDate !== undefined ||
      data.labelColor !== undefined,
    { message: "At least one of title, description, dueDate, or labelColor must be provided" },
  );

export const cardDeleteSchema = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
});

export const commentCreateSchema = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export const commentListSchema = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
});

export const cursorMoveSchema = z.object({
  boardId: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export type CardCreatePayload = z.infer<typeof cardCreateSchema>;
export type CardMovePayload = z.infer<typeof cardMoveSchema>;
export type CardUpdatePayload = z.infer<typeof cardUpdateSchema>;
export type CardDeletePayload = z.infer<typeof cardDeleteSchema>;
export type CommentCreatePayload = z.infer<typeof commentCreateSchema>;
export type CommentListPayload = z.infer<typeof commentListSchema>;
export type CursorMovePayload = z.infer<typeof cursorMoveSchema>;

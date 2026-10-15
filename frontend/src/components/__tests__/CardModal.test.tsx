import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardItem, CommentItem } from "../../types";

const emitCommentList = vi.fn();
const emitCommentCreate = vi.fn();

vi.mock("../../services/socket", () => ({
  emitCommentList: (...args: unknown[]) => emitCommentList(...args),
  emitCommentCreate: (...args: unknown[]) => emitCommentCreate(...args),
}));

import { CardModal } from "../CardModal";
import { useBoardStore } from "../../store/board";

const card: CardItem = {
  id: "card-1",
  columnId: "col-1",
  title: "Fix layout",
  description: "Mobile nav overlaps the header",
  order: 0,
};

const comment: CommentItem = {
  id: "comment-1",
  cardId: "card-1",
  authorId: "u2",
  authorName: "Bob",
  body: "Already looking into it",
  createdAt: new Date().toISOString(),
};

describe("CardModal comments", () => {
  beforeEach(() => {
    emitCommentList.mockReset();
    emitCommentCreate.mockReset();
    useBoardStore.getState().reset();
  });

  it("requests the card's comments on open", () => {
    render(<CardModal boardId="board-1" card={card} onSave={() => {}} onClose={() => {}} />);

    expect(emitCommentList).toHaveBeenCalledWith({ boardId: "board-1", cardId: "card-1" }, expect.any(Function));
  });

  it("renders comments already in the store", () => {
    useBoardStore.getState().setComments("card-1", [comment]);

    render(<CardModal boardId="board-1" card={card} onSave={() => {}} onClose={() => {}} />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Already looking into it")).toBeInTheDocument();
  });

  it("posts a new comment and clears the input", () => {
    render(<CardModal boardId="board-1" card={card} onSave={() => {}} onClose={() => {}} />);

    const textarea = screen.getByPlaceholderText("Write a comment…");
    fireEvent.change(textarea, { target: { value: "Looks good to me" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(emitCommentCreate).toHaveBeenCalledWith(
      { boardId: "board-1", cardId: "card-1", body: "Looks good to me" },
      expect.any(Function),
    );
    expect(textarea).toHaveValue("");
  });

  it("does not show a comment section when creating a new card", () => {
    render(<CardModal boardId="board-1" onSave={() => {}} onClose={() => {}} />);

    expect(screen.queryByText("Comments")).not.toBeInTheDocument();
    expect(emitCommentList).not.toHaveBeenCalled();
  });
});

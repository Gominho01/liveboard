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
  dueDate: null,
  labelColor: null,
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

describe("CardModal labels and due dates", () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
  });

  it("selects a label color and submits it", () => {
    const onSave = vi.fn();
    render(<CardModal boardId="board-1" onSave={onSave} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Red label" }));
    expect(screen.getByRole("button", { name: "Red label" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Ship it" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Ship it", labelColor: "#e03131" }),
    );
  });

  it("deselects a label color when clicked again", () => {
    const onSave = vi.fn();
    render(<CardModal boardId="board-1" onSave={onSave} onClose={() => {}} />);

    const redSwatch = screen.getByRole("button", { name: "Red label" });
    fireEvent.click(redSwatch);
    fireEvent.click(redSwatch);
    expect(redSwatch).toHaveAttribute("aria-pressed", "false");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Ship it" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ labelColor: null }));
  });

  it("submits a due date as an ISO string", () => {
    const onSave = vi.fn();
    render(<CardModal boardId="board-1" onSave={onSave} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Ship it" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: new Date("2026-12-01").toISOString() }),
    );
  });

  it("pre-fills the label and due date from an existing card", () => {
    render(
      <CardModal
        boardId="board-1"
        card={{ ...card, dueDate: "2026-12-01T00:00:00.000Z", labelColor: "#2f9e44" }}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Green label" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-12-01");
  });
});

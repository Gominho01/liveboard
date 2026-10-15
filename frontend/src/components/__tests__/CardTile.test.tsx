import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CardItem } from "../../types";

// CardTile uses dnd-kit's useSortable, which needs a DndContext provider to
// run — not relevant to what this test checks, so it's mocked out the same
// way a socket/store dependency would be.
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

import { CardTile } from "../CardTile";

const card: CardItem = {
  id: "card-1",
  columnId: "col-1",
  title: "Fix layout bug",
  description: "Mobile nav overlaps the header",
  order: 0,
  dueDate: null,
  labelColor: null,
};

describe("CardTile search filtering", () => {
  it("stays visible with no search term", () => {
    render(<CardTile card={card} isDoneColumn={false} search="" onEdit={() => {}} />);
    expect(screen.getByText("Fix layout bug").closest(".card-tile")).not.toHaveAttribute("aria-hidden", "true");
  });

  it("stays visible when the title matches", () => {
    render(<CardTile card={card} isDoneColumn={false} search="layout" onEdit={() => {}} />);
    expect(screen.getByText("Fix layout bug").closest(".card-tile")).not.toHaveStyle({ display: "none" });
  });

  it("stays visible when the description matches", () => {
    render(<CardTile card={card} isDoneColumn={false} search="mobile nav" onEdit={() => {}} />);
    expect(screen.getByText("Fix layout bug").closest(".card-tile")).not.toHaveAttribute("aria-hidden", "true");
  });

  it("is hidden (but still mounted) when nothing matches", () => {
    render(<CardTile card={card} isDoneColumn={false} search="nothing matches this" onEdit={() => {}} />);
    const tile = screen.getByText("Fix layout bug").closest(".card-tile");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveStyle({ display: "none" });
  });
});

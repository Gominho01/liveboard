import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent } from "react";
import type { CardItem } from "../types";

// Due dates are stored as a UTC-midnight timestamp for a calendar date with
// no time component (see CardModal) — format in UTC too, so the displayed
// day doesn't shift backward/forward for viewers in other timezones.
function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

interface CardTileProps {
  card: CardItem;
  isDoneColumn: boolean;
  onEdit: (card: CardItem) => void;
}

export function CardTile({ card, isDoneColumn, onEdit }: CardTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { columnId: card.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = !isDoneColumn && !!card.dueDate && new Date(card.dueDate) < new Date();

  // Space is reserved for the keyboard drag sensor (pick up/drop); Enter is
  // free to open the edit modal instead, since dnd-kit's own listener would
  // otherwise treat Enter as a second "pick up" key too.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    listeners?.onKeyDown?.(event);
    if (event.key === "Enter") {
      event.preventDefault();
      onEdit(card);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card-tile"
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={() => onEdit(card)}
    >
      <p className="card-title">{card.title}</p>
      {card.description && <p className="card-description">{card.description}</p>}
      {(card.labelColor || card.dueDate) && (
        <div className="card-meta">
          {card.labelColor && (
            <span className="label-dot" style={{ background: card.labelColor }} aria-hidden="true" />
          )}
          {card.dueDate && (
            <span className={`due-date-badge${isOverdue ? " due-date-overdue" : ""}`}>
              {isOverdue ? "Overdue · " : ""}
              {formatDueDate(card.dueDate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

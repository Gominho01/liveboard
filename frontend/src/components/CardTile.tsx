import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent } from "react";
import type { CardItem } from "../types";

interface CardTileProps {
  card: CardItem;
  onEdit: (card: CardItem) => void;
}

export function CardTile({ card, onEdit }: CardTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { columnId: card.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
    </div>
  );
}

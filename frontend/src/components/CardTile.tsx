import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card-tile"
      {...attributes}
      {...listeners}
      onClick={() => onEdit(card)}
    >
      <p className="card-title">{card.title}</p>
      {card.description && <p className="card-description">{card.description}</p>}
    </div>
  );
}

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { CardItem, ColumnItem } from "../types";
import { CardTile } from "./CardTile";

interface BoardColumnProps {
  column: ColumnItem;
  onAddCard: (columnId: string) => void;
  onEditCard: (card: CardItem) => void;
}

export function BoardColumn({ column, onAddCard, onEditCard }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section className={`board-column${isOver ? " board-column-over" : ""}`}>
      <header className="board-column-header">
        <h2>{column.name}</h2>
        <span className="board-column-count">{column.cards.length}</span>
      </header>

      <div ref={setNodeRef} className="board-column-cards">
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardTile key={card.id} card={card} onEdit={onEditCard} />
          ))}
        </SortableContext>
      </div>

      <button type="button" className="add-card-button" onClick={() => onAddCard(column.id)}>
        + Add card
      </button>
    </section>
  );
}

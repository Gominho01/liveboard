import { useState } from "react";
import type { FormEvent } from "react";
import type { CardItem } from "../types";

interface CardModalProps {
  card?: CardItem;
  onSave: (title: string, description: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function CardModal({ card, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), description.trim());
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{card ? "Edit card" : "New card"}</h2>

        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </label>

        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <div className="modal-actions">
          {card && onDelete && (
            <button type="button" className="danger-button" onClick={onDelete}>
              Delete
            </button>
          )}
          <div className="modal-actions-right">
            <button type="button" className="link-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </div>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { emitCommentCreate, emitCommentList } from "../services/socket";
import { useBoardStore } from "../store/board";
import type { CardItem } from "../types";
import { PALETTE as LABEL_COLORS } from "../utils/userColor";

// A stable reference, so the Zustand selector below doesn't return a new
// array identity on every call (which would trigger an infinite render loop).
const NO_COMMENTS: never[] = [];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export interface CardSaveData {
  title: string;
  description: string;
  dueDate: string | null;
  labelColor: string | null;
}

interface CardModalProps {
  boardId: string;
  card?: CardItem;
  onSave: (data: CardSaveData) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function CardModal({ boardId, card, onSave, onDelete, onClose }: CardModalProps) {
  const { ref, titleId } = useDialogA11y<HTMLFormElement>(onClose);
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [dueDate, setDueDate] = useState(card?.dueDate ? card.dueDate.slice(0, 10) : "");
  const [labelColor, setLabelColor] = useState<string | null>(card?.labelColor ?? null);
  const [commentBody, setCommentBody] = useState("");

  const comments = useBoardStore((s) => (card ? (s.commentsByCardId[card.id] ?? NO_COMMENTS) : NO_COMMENTS));
  const setComments = useBoardStore((s) => s.setComments);
  const addComment = useBoardStore((s) => s.addComment);

  useEffect(() => {
    if (!card) return;
    emitCommentList({ boardId, cardId: card.id }, (list) => setComments(card.id, list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, boardId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      labelColor,
    });
  }

  function handlePostComment() {
    const body = commentBody.trim();
    if (!body || !card) return;
    emitCommentCreate({ boardId, cardId: card.id, body }, (comment) => addComment(comment));
    setCommentBody("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        ref={ref}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id={titleId}>{card ? "Edit card" : "New card"}</h2>

        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <div className="label-picker">
          <span className="label-picker-title">Label</span>
          <div className="label-swatches" role="group" aria-label="Label color">
            {LABEL_COLORS.map((color) => {
              const selected = labelColor === color.value;
              return (
                <button
                  key={color.value}
                  type="button"
                  className={`label-swatch${selected ? " label-swatch-selected" : ""}`}
                  aria-label={`${color.name} label`}
                  aria-pressed={selected}
                  onClick={() => setLabelColor(selected ? null : color.value)}
                >
                  <span className="label-dot" style={{ background: color.value }} aria-hidden="true" />
                  {selected && (
                    <span className="label-swatch-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {card && (
          <div className="comment-section">
            <h3>Comments</h3>
            {comments.length === 0 ? (
              <p className="comment-empty">No comments yet.</p>
            ) : (
              <ul className="comment-list">
                {comments.map((comment) => (
                  <li key={comment.id} className="comment-item">
                    <div className="comment-meta">
                      <span className="comment-author">{comment.authorName}</span>
                      <span className="comment-time">{formatTime(comment.createdAt)}</span>
                    </div>
                    <p className="comment-body">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="comment-form">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                aria-label="Write a comment"
              />
              <button type="button" onClick={handlePostComment} disabled={!commentBody.trim()}>
                Post
              </button>
            </div>
          </div>
        )}

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

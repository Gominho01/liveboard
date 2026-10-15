import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { emitCommentCreate, emitCommentList } from "../services/socket";
import { useBoardStore } from "../store/board";
import type { CardItem } from "../types";

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

interface CardModalProps {
  boardId: string;
  card?: CardItem;
  onSave: (title: string, description: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function CardModal({ boardId, card, onSave, onDelete, onClose }: CardModalProps) {
  const { ref, titleId } = useDialogA11y<HTMLFormElement>(onClose);
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
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
    onSave(title.trim(), description.trim());
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

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createBoard, listBoards } from "../services/api";
import { useAuthStore } from "../store/auth";
import type { BoardSummary } from "../types";

interface BoardListPageProps {
  onSelect: (boardId: string) => void;
}

export function BoardListPage({ onSelect }: BoardListPageProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    listBoards(token)
      .then(setBoards)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load boards"));
  }, [token]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !name.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const board = await createBoard(token, name.trim());
      onSelect(board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="board-list-page">
      <header className="board-header">
        <h1>Your boards</h1>
        <div className="board-header-right">
          {user && <p className="board-subtitle">Signed in as {user.name}</p>}
          <button type="button" className="link-button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className="board-error">{error}</p>}

      {!boards ? (
        <p className="board-loading">Loading boards…</p>
      ) : boards.length === 0 ? (
        <p className="board-empty">You don't belong to any boards yet — create one below.</p>
      ) : (
        <ul className="board-list">
          {boards.map((board) => (
            <li key={board.id}>
              <button type="button" className="board-list-item" onClick={() => onSelect(board.id)}>
                <span>{board.name}</span>
                <span className="board-role-badge">{board.role === "OWNER" ? "Owner" : "Member"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="board-create-form" onSubmit={handleCreate}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New board name"
          aria-label="New board name"
          required
        />
        <button type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create board"}
        </button>
      </form>
    </div>
  );
}

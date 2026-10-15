import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ActivityFeed } from "../components/ActivityFeed";
import { BoardColumn } from "../components/BoardColumn";
import { CardModal, type CardSaveData } from "../components/CardModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CursorOverlay } from "../components/CursorOverlay";
import { InviteModal } from "../components/InviteModal";
import { PresenceList } from "../components/PresenceList";
import { ThemeToggle } from "../components/ThemeToggle";
import { useBoardSocket } from "../hooks/useBoardSocket";
import { fetchBoard } from "../services/api";
import {
  emitCardCreate,
  emitCardDelete,
  emitCardMove,
  emitCardUpdate,
  emitCursorMove,
} from "../services/socket";
import { useAuthStore } from "../store/auth";
import { useBoardStore } from "../store/board";
import type { CardItem } from "../types";

interface BoardPageProps {
  boardId: string;
  onBack: () => void;
}

export function BoardPage({ boardId, onBack }: BoardPageProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const board = useBoardStore((s) => s.board);
  const presence = useBoardStore((s) => s.presence);
  const activity = useBoardStore((s) => s.activity);
  const cursors = useBoardStore((s) => s.cursors);
  const setBoard = useBoardStore((s) => s.setBoard);
  const applyCardUpsert = useBoardStore((s) => s.applyCardUpsert);
  const applyCardDelete = useBoardStore((s) => s.applyCardDelete);
  const reset = useBoardStore((s) => s.reset);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ columnId: string; card?: CardItem } | null>(null);
  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [socketErrorMessage, setSocketErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const lastCursorEmit = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Enter is left free for opening the edit modal (see CardTile), so only
    // Space picks a card up and drops it — arrow keys move it once held.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  useEffect(() => {
    if (!token) return;
    fetchBoard(token, boardId)
      .then(setBoard)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load board"));

    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, boardId]);

  const { connected, lastError } = useBoardSocket(token, board?.id ?? null);

  useEffect(() => {
    if (!lastError) return;
    setSocketErrorMessage(lastError.message);
    const timer = setTimeout(() => setSocketErrorMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [lastError]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = document.activeElement;
      const isEditable = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (isEditable) return;

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === "n" && board && board.columns.length > 0) {
        event.preventDefault();
        setModalState({ columnId: board.columns[0]!.id });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [board]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !board) return;

    const activeCard = board.columns.flatMap((c) => c.cards).find((c) => c.id === active.id);
    if (!activeCard) return;

    const overColumn = board.columns.find((c) => c.id === over.id);
    let targetColumnId: string;
    let targetIndex: number;

    if (overColumn) {
      targetColumnId = overColumn.id;
      targetIndex = overColumn.cards.filter((c) => c.id !== activeCard.id).length;
    } else {
      const overCard = board.columns.flatMap((c) => c.cards).find((c) => c.id === over.id);
      if (!overCard) return;
      targetColumnId = overCard.columnId;
      const targetColumn = board.columns.find((c) => c.id === targetColumnId)!;
      targetIndex = targetColumn.cards.filter((c) => c.id !== activeCard.id).findIndex((c) => c.id === overCard.id);
    }

    if (targetColumnId === activeCard.columnId && targetIndex === activeCard.order) return;

    const updatedCard: CardItem = { ...activeCard, columnId: targetColumnId, order: targetIndex };
    applyCardUpsert(updatedCard);
    emitCardMove({ boardId: board.id, cardId: activeCard.id, columnId: targetColumnId, order: targetIndex });
  }

  // Throttled to ~20/s — mousemove fires far more often than the socket
  // needs, and position is sent as a 0-1 fraction of this container so it
  // stays meaningful across viewers with different window sizes.
  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (!board) return;
    const now = Date.now();
    if (now - lastCursorEmit.current < 50) return;
    lastCursorEmit.current = now;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    emitCursorMove({ boardId: board.id, x, y });
  }

  function handleSaveCard({ title, description, dueDate, labelColor }: CardSaveData) {
    if (!board || !modalState) return;

    if (modalState.card) {
      const updated: CardItem = {
        ...modalState.card,
        title,
        description: description || null,
        dueDate,
        labelColor,
      };
      applyCardUpsert(updated);
      emitCardUpdate({ boardId: board.id, cardId: modalState.card.id, title, description, dueDate, labelColor });
    } else {
      emitCardCreate(
        { boardId: board.id, columnId: modalState.columnId, title, description, dueDate, labelColor },
        (card) => {
          applyCardUpsert(card);
        },
      );
    }
    setModalState(null);
  }

  function handleDeleteCard() {
    if (!board || !modalState?.card) return;
    const { card } = modalState;
    applyCardDelete({ id: card.id, columnId: card.columnId });
    emitCardDelete({ boardId: board.id, cardId: card.id });
    setModalState(null);
    setConfirmDeleteCard(false);
  }

  if (loadError) {
    return (
      <div className="board-error-page">
        <p className="board-error">{loadError}</p>
        <button type="button" className="link-button" onClick={onBack}>
          ← Back to your boards
        </button>
      </div>
    );
  }

  if (!board) {
    return <p className="board-loading">Loading board…</p>;
  }

  return (
    <div className="board-page">
      <header className="board-header">
        <div>
          <button type="button" className="link-button board-back-button" onClick={onBack}>
            ← Boards
          </button>
          <h1>{board.name}</h1>
          {user && <p className="board-subtitle">Signed in as {user.name}</p>}
        </div>
        <div className="board-header-right">
          <span className={`connection-status${connected ? "" : " connection-status-offline"}`}>
            <span aria-hidden="true" className="connection-dot" />
            {connected ? "Live" : "Offline"}
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards… (/)"
            aria-label="Search cards"
            className="board-search"
          />
          <PresenceList users={presence} />
          <button type="button" className="link-button" onClick={() => setShowInvite(true)}>
            Invite
          </button>
          <ThemeToggle />
          <button type="button" className="link-button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="board-layout">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="board-columns" onMouseMove={handleMouseMove}>
            {board.columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                search={search}
                onAddCard={(columnId) => setModalState({ columnId })}
                onEditCard={(card) => setModalState({ columnId: card.columnId, card })}
              />
            ))}
            <CursorOverlay cursors={cursors} />
          </div>
        </DndContext>

        <ActivityFeed entries={activity} />
      </div>

      {modalState && (
        <CardModal
          boardId={board.id}
          card={modalState.card}
          onSave={handleSaveCard}
          onDelete={modalState.card ? () => setConfirmDeleteCard(true) : undefined}
          onClose={() => setModalState(null)}
        />
      )}

      {confirmDeleteCard && modalState?.card && (
        <ConfirmDialog
          title="Delete card"
          message={`Delete "${modalState.card.title}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteCard}
          onCancel={() => setConfirmDeleteCard(false)}
        />
      )}

      {showInvite && <InviteModal boardId={board.id} onClose={() => setShowInvite(false)} />}

      {socketErrorMessage && (
        <div className="socket-toast" role="status">
          {socketErrorMessage}
        </div>
      )}
    </div>
  );
}

import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { ActivityFeed } from "../components/ActivityFeed";
import { BoardColumn } from "../components/BoardColumn";
import { CardModal } from "../components/CardModal";
import { PresenceList } from "../components/PresenceList";
import { useBoardSocket } from "../hooks/useBoardSocket";
import { fetchDefaultBoard } from "../services/api";
import { emitCardCreate, emitCardDelete, emitCardMove, emitCardUpdate } from "../services/socket";
import { useAuthStore } from "../store/auth";
import { useBoardStore } from "../store/board";
import type { CardItem } from "../types";

export function BoardPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const board = useBoardStore((s) => s.board);
  const presence = useBoardStore((s) => s.presence);
  const activity = useBoardStore((s) => s.activity);
  const setBoard = useBoardStore((s) => s.setBoard);
  const applyCardUpsert = useBoardStore((s) => s.applyCardUpsert);
  const applyCardDelete = useBoardStore((s) => s.applyCardDelete);
  const reset = useBoardStore((s) => s.reset);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ columnId: string; card?: CardItem } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!token) return;
    fetchDefaultBoard(token)
      .then(setBoard)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load board"));

    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useBoardSocket(token, board?.id ?? null);

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

  function handleSaveCard(title: string, description: string) {
    if (!board || !modalState) return;

    if (modalState.card) {
      const updated: CardItem = { ...modalState.card, title, description: description || null };
      applyCardUpsert(updated);
      emitCardUpdate({ boardId: board.id, cardId: modalState.card.id, title, description });
    } else {
      emitCardCreate({ boardId: board.id, columnId: modalState.columnId, title, description }, (card) => {
        applyCardUpsert(card);
      });
    }
    setModalState(null);
  }

  function handleDeleteCard() {
    if (!board || !modalState?.card) return;
    const { card } = modalState;
    applyCardDelete({ id: card.id, columnId: card.columnId });
    emitCardDelete({ boardId: board.id, cardId: card.id });
    setModalState(null);
  }

  if (loadError) {
    return <p className="board-error">{loadError}</p>;
  }

  if (!board) {
    return <p className="board-loading">Loading board…</p>;
  }

  return (
    <div className="board-page">
      <header className="board-header">
        <div>
          <h1>{board.name}</h1>
          {user && <p className="board-subtitle">Signed in as {user.name}</p>}
        </div>
        <div className="board-header-right">
          <PresenceList users={presence} />
          <button type="button" className="link-button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="board-layout">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="board-columns">
            {board.columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                onAddCard={(columnId) => setModalState({ columnId })}
                onEditCard={(card) => setModalState({ columnId: card.columnId, card })}
              />
            ))}
          </div>
        </DndContext>

        <ActivityFeed entries={activity} />
      </div>

      {modalState && (
        <CardModal
          card={modalState.card}
          onSave={handleSaveCard}
          onDelete={modalState.card ? handleDeleteCard : undefined}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}

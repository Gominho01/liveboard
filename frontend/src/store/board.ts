import { create } from "zustand";
import type {
  ActivityEntry,
  BoardData,
  CardDeleteEvent,
  CardItem,
  ColumnItem,
  CommentItem,
  CursorPosition,
  PresenceUser,
} from "../types";

interface BoardState {
  board: BoardData | null;
  presence: PresenceUser[];
  activity: ActivityEntry[];
  commentsByCardId: Record<string, CommentItem[]>;
  cursors: Record<string, CursorPosition>;
  setBoard: (board: BoardData) => void;
  applyCardUpsert: (card: CardItem) => void;
  applyCardDelete: (payload: CardDeleteEvent) => void;
  setPresence: (presence: PresenceUser[]) => void;
  addPresence: (user: PresenceUser) => void;
  removePresence: (user: PresenceUser) => void;
  setActivity: (entries: ActivityEntry[]) => void;
  addActivity: (entry: ActivityEntry) => void;
  setComments: (cardId: string, comments: CommentItem[]) => void;
  addComment: (comment: CommentItem) => void;
  setCursor: (cursor: CursorPosition) => void;
  removeCursor: (userId: string) => void;
  reset: () => void;
}

function upsertCard(columns: ColumnItem[], card: CardItem): ColumnItem[] {
  return columns.map((column) => {
    const cardsWithoutIt = column.cards.filter((c) => c.id !== card.id);
    if (column.id !== card.columnId) {
      return { ...column, cards: cardsWithoutIt };
    }
    return {
      ...column,
      cards: [...cardsWithoutIt, card].sort((a, b) => a.order - b.order),
    };
  });
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  presence: [],
  activity: [],
  commentsByCardId: {},
  cursors: {},

  setBoard: (board) => set({ board }),

  applyCardUpsert: (card) =>
    set((state) =>
      state.board ? { board: { ...state.board, columns: upsertCard(state.board.columns, card) } } : state,
    ),

  applyCardDelete: ({ id, columnId }) =>
    set((state) => {
      if (!state.board) return state;
      const columns = state.board.columns.map((column) =>
        column.id === columnId ? { ...column, cards: column.cards.filter((c) => c.id !== id) } : column,
      );
      return { board: { ...state.board, columns } };
    }),

  setPresence: (presence) => set({ presence }),

  addPresence: (user) =>
    set((state) => (state.presence.some((u) => u.id === user.id) ? state : { presence: [...state.presence, user] })),

  removePresence: (user) => set((state) => ({ presence: state.presence.filter((u) => u.id !== user.id) })),

  setActivity: (entries) => set({ activity: entries }),

  addActivity: (entry) =>
    set((state) => (state.activity.some((a) => a.id === entry.id) ? state : { activity: [entry, ...state.activity].slice(0, 50) })),

  setComments: (cardId, comments) =>
    set((state) => ({ commentsByCardId: { ...state.commentsByCardId, [cardId]: comments } })),

  addComment: (comment) =>
    set((state) => {
      const existing = state.commentsByCardId[comment.cardId] ?? [];
      if (existing.some((c) => c.id === comment.id)) return state;
      return { commentsByCardId: { ...state.commentsByCardId, [comment.cardId]: [...existing, comment] } };
    }),

  setCursor: (cursor) => set((state) => ({ cursors: { ...state.cursors, [cursor.userId]: cursor } })),

  removeCursor: (userId) =>
    set((state) => {
      if (!(userId in state.cursors)) return state;
      const cursors = { ...state.cursors };
      delete cursors[userId];
      return { cursors };
    }),

  reset: () => set({ board: null, presence: [], activity: [], commentsByCardId: {}, cursors: {} }),
}));

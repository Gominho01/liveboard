import { create } from "zustand";
import type {
  ActivityEntry,
  BoardData,
  CardDeleteEvent,
  CardItem,
  ColumnItem,
  PresenceUser,
} from "../types";

interface BoardState {
  board: BoardData | null;
  presence: PresenceUser[];
  activity: ActivityEntry[];
  setBoard: (board: BoardData) => void;
  applyCardUpsert: (card: CardItem) => void;
  applyCardDelete: (payload: CardDeleteEvent) => void;
  setPresence: (presence: PresenceUser[]) => void;
  addPresence: (user: PresenceUser) => void;
  removePresence: (user: PresenceUser) => void;
  setActivity: (entries: ActivityEntry[]) => void;
  addActivity: (entry: ActivityEntry) => void;
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

  reset: () => set({ board: null, presence: [], activity: [] }),
}));

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CardItem {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ColumnItem {
  id: string;
  boardId: string;
  name: string;
  order: number;
  cards: CardItem[];
}

export interface BoardData {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: string;
  columns: ColumnItem[];
}

export interface PresenceUser {
  id: string;
  name: string;
}

export interface ActivityEntry {
  id: string;
  boardId: string;
  userId: string;
  message: string;
  createdAt: string;
}

// Socket event payloads — kept by hand in sync with backend/src/sockets/schemas.ts

export interface CardCreatePayload {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
}

export interface CardMovePayload {
  boardId: string;
  cardId: string;
  columnId: string;
  order: number;
}

export interface CardUpdatePayload {
  boardId: string;
  cardId: string;
  title?: string;
  description?: string;
}

export interface CardDeletePayload {
  boardId: string;
  cardId: string;
}

export interface CardDeleteEvent {
  id: string;
  columnId: string;
}

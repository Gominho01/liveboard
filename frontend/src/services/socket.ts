import { io, type Socket } from "socket.io-client";
import type {
  CardCreatePayload,
  CardDeletePayload,
  CardItem,
  CardMovePayload,
  CardUpdatePayload,
} from "../types";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3333";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  socket?.disconnect();
  socket = io(SOCKET_URL, { auth: { token } });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function joinBoard(boardId: string): void {
  socket?.emit("board:join", boardId);
}

/** Uses an ack callback so the sender gets the persisted card (with its
 * server-generated id) directly, instead of a broadcast it wouldn't receive. */
export function emitCardCreate(payload: CardCreatePayload, onCreated: (card: CardItem) => void): void {
  socket?.emit("card:create", payload, onCreated);
}

export function emitCardMove(payload: CardMovePayload): void {
  socket?.emit("card:move", payload);
}

export function emitCardUpdate(payload: CardUpdatePayload): void {
  socket?.emit("card:update", payload);
}

export function emitCardDelete(payload: CardDeletePayload): void {
  socket?.emit("card:delete", payload);
}

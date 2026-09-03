import { useEffect } from "react";
import { connectSocket, disconnectSocket, joinBoard } from "../services/socket";
import { useBoardStore } from "../store/board";
import type { ActivityEntry, CardDeleteEvent, CardItem, PresenceUser } from "../types";

/** Connects to the socket server, joins the given board room, and wires
 * every real-time event into the board store. Cleans up on unmount. */
export function useBoardSocket(token: string | null, boardId: string | null): void {
  const applyCardUpsert = useBoardStore((s) => s.applyCardUpsert);
  const applyCardDelete = useBoardStore((s) => s.applyCardDelete);
  const setPresence = useBoardStore((s) => s.setPresence);
  const addPresence = useBoardStore((s) => s.addPresence);
  const removePresence = useBoardStore((s) => s.removePresence);
  const setActivity = useBoardStore((s) => s.setActivity);
  const addActivity = useBoardStore((s) => s.addActivity);

  useEffect(() => {
    if (!token || !boardId) return;

    const socket = connectSocket(token);

    const onPresenceList = (list: PresenceUser[]) => setPresence(list);
    const onPresenceJoin = (user: PresenceUser) => addPresence(user);
    const onPresenceLeave = (user: PresenceUser) => removePresence(user);
    const onCardUpsert = (card: CardItem) => applyCardUpsert(card);
    const onCardDelete = (payload: CardDeleteEvent) => applyCardDelete(payload);
    const onActivityList = (entries: ActivityEntry[]) => setActivity(entries);
    const onActivity = (entry: ActivityEntry) => addActivity(entry);
    const onSocketError = (payload: { message: string }) => console.warn("[socket]", payload.message);

    socket.on("presence:list", onPresenceList);
    socket.on("presence:join", onPresenceJoin);
    socket.on("presence:leave", onPresenceLeave);
    socket.on("card:create", onCardUpsert);
    socket.on("card:move", onCardUpsert);
    socket.on("card:update", onCardUpsert);
    socket.on("card:delete", onCardDelete);
    socket.on("activity:list", onActivityList);
    socket.on("activity:new", onActivity);
    socket.on("error", onSocketError);

    socket.on("connect", () => joinBoard(boardId));
    if (socket.connected) joinBoard(boardId);

    return () => {
      socket.off("presence:list", onPresenceList);
      socket.off("presence:join", onPresenceJoin);
      socket.off("presence:leave", onPresenceLeave);
      socket.off("card:create", onCardUpsert);
      socket.off("card:move", onCardUpsert);
      socket.off("card:update", onCardUpsert);
      socket.off("card:delete", onCardDelete);
      socket.off("activity:list", onActivityList);
      socket.off("activity:new", onActivity);
      socket.off("error", onSocketError);
      disconnectSocket();
    };
  }, [
    token,
    boardId,
    applyCardUpsert,
    applyCardDelete,
    setPresence,
    addPresence,
    removePresence,
    setActivity,
    addActivity,
  ]);
}

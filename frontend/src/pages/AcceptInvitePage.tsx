import { useEffect, useState } from "react";
import { acceptInvite } from "../services/api";
import { useAuthStore } from "../store/auth";

interface AcceptInvitePageProps {
  inviteToken: string;
  onJoined: (boardId: string) => void;
}

export function AcceptInvitePage({ inviteToken, onJoined }: AcceptInvitePageProps) {
  const token = useAuthStore((s) => s.token);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    acceptInvite(token, inviteToken)
      .then((board) => onJoined(board.id))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to join board"));
    // onJoined is a fresh closure every render; only re-run when the token(s) change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, inviteToken]);

  if (error) {
    return <p className="board-error">{error}</p>;
  }

  return <p className="board-loading">Joining board…</p>;
}

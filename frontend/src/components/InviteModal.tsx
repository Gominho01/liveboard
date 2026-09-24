import { useEffect, useState } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { getInviteLink, regenerateInviteLink } from "../services/api";
import { useAuthStore } from "../store/auth";

interface InviteModalProps {
  boardId: string;
  onClose: () => void;
}

type Status = "loading" | "ready" | "forbidden" | "error";

export function InviteModal({ boardId, onClose }: InviteModalProps) {
  const { ref, titleId } = useDialogA11y<HTMLDivElement>(onClose);
  const authToken = useAuthStore((s) => s.token);
  const [status, setStatus] = useState<Status>("loading");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    getInviteLink(authToken, boardId)
      .then((res) => {
        setInviteToken(res.token);
        setStatus("ready");
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "";
        setStatus(message.toLowerCase().includes("owner") ? "forbidden" : "error");
      });
  }, [authToken, boardId]);

  const link = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : "";

  async function handleRegenerate() {
    if (!authToken) return;
    setRegenerating(true);
    try {
      const res = await regenerateInviteLink(authToken, boardId);
      setInviteToken(res.token);
      setCopied(false);
    } catch {
      setStatus("error");
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>Invite to this board</h2>

        {status === "loading" && <p>Loading…</p>}
        {status === "forbidden" && <p>Only the board owner can share an invite link.</p>}
        {status === "error" && <p className="board-error">Couldn't load the invite link.</p>}

        {status === "ready" && (
          <label>
            Anyone with this link can join this board
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}

        <div className="modal-actions">
          {status === "ready" ? (
            <button type="button" className="link-button" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? "Generating…" : "Generate new link"}
            </button>
          ) : (
            <span />
          )}
          <div className="modal-actions-right">
            <button type="button" className="link-button" onClick={onClose}>
              Close
            </button>
            {status === "ready" && (
              <button type="button" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

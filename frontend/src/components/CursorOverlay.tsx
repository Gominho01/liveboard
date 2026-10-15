import type { CursorPosition } from "../types";
import { colorForUser } from "../utils/userColor";

export function CursorOverlay({ cursors }: { cursors: Record<string, CursorPosition> }) {
  return (
    <>
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.userId}
          className="cursor-overlay"
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          aria-hidden="true"
        >
          <span className="cursor-dot" style={{ background: colorForUser(cursor.userId) }} />
          <span className="cursor-label" style={{ background: colorForUser(cursor.userId) }}>
            {cursor.name}
          </span>
        </div>
      ))}
    </>
  );
}

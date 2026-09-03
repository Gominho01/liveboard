import type { ActivityEntry } from "../types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <aside className="activity-feed">
      <h2>Activity</h2>
      {entries.length === 0 ? (
        <p className="activity-empty">No activity yet.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className="activity-message">{entry.message}</span>
              <span className="activity-time">{formatTime(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

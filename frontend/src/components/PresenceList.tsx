import type { PresenceUser } from "../types";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PresenceList({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="presence-list" title={users.map((u) => u.name).join(", ")}>
      {users.map((user) => (
        <span key={user.id} className="presence-avatar">
          {initials(user.name)}
        </span>
      ))}
    </div>
  );
}

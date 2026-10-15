import { Avatar } from "./Avatar";
import type { PresenceUser } from "../types";

export function PresenceList({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="presence-list" title={users.map((u) => u.name).join(", ")}>
      {users.map((user) => (
        <Avatar key={user.id} seed={user.id} name={user.name} />
      ))}
    </div>
  );
}

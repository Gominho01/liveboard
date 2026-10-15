import { avatarUrl } from "../services/avatar";

export function Avatar({ seed, name, size = 28 }: { seed: string; name: string; size?: number }) {
  return <img src={avatarUrl(seed)} alt={`${name}'s avatar`} width={size} height={size} className="avatar" />;
}

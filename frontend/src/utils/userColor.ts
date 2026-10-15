// One shared color language for the app: card labels and live cursors both
// draw from this same six-color palette.
export const PALETTE: { value: string; name: string }[] = [
  { value: "#e03131", name: "Red" },
  { value: "#f08c00", name: "Orange" },
  { value: "#f5c518", name: "Yellow" },
  { value: "#2f9e44", name: "Green" },
  { value: "#1971c2", name: "Blue" },
  { value: "#9c36b5", name: "Purple" },
];

/** Deterministic: the same user id always maps to the same color, with no
 * coordination needed between clients. */
export function colorForUser(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!.value;
}

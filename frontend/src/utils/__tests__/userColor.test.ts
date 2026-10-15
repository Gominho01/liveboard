import { describe, expect, it } from "vitest";
import { colorForUser, PALETTE } from "../userColor";

describe("colorForUser", () => {
  it("is deterministic for the same id", () => {
    expect(colorForUser("user-1")).toBe(colorForUser("user-1"));
  });

  it("always returns a color from the palette", () => {
    expect(PALETTE.map((c) => c.value)).toContain(colorForUser("some-user-id"));
  });

  it("can assign different colors to different ids", () => {
    const colors = new Set(["alice", "bob", "carol", "dave"].map(colorForUser));
    expect(colors.size).toBeGreaterThan(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, currentEffectiveTheme, getStoredTheme, setTheme } from "../theme";

function mockMatchMedia(matchesDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: matchesDark, media: "", addEventListener: () => {}, removeEventListener: () => {} }),
  );
}

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("has no stored theme by default", () => {
    expect(getStoredTheme()).toBeNull();
  });

  it("persists and applies an explicit choice", () => {
    setTheme("dark");
    expect(getStoredTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to the system preference when nothing is stored", () => {
    mockMatchMedia(true);
    expect(currentEffectiveTheme()).toBe("dark");

    mockMatchMedia(false);
    expect(currentEffectiveTheme()).toBe("light");
  });

  it("prefers the stored choice over the system preference", () => {
    mockMatchMedia(true);
    setTheme("light");
    expect(currentEffectiveTheme()).toBe("light");
  });

  it("removes the data-theme attribute when applying null", () => {
    setTheme("dark");
    applyTheme(null);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

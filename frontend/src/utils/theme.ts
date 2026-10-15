export type Theme = "light" | "dark";

const KEY = "liveboard-theme";

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" ? value : null;
}

/** The stored choice, or whatever the system currently prefers if the user
 * hasn't picked one explicitly yet. */
export function currentEffectiveTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme | null): void {
  if (theme) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

/** Applies whatever theme was last chosen — call once at startup, before the
 * first paint, so there's no flash of the wrong theme. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
}

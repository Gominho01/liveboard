import { useState } from "react";
import { currentEffectiveTheme, setTheme, type Theme } from "../utils/theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => currentEffectiveTheme());

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button type="button" className="link-button" onClick={toggle}>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

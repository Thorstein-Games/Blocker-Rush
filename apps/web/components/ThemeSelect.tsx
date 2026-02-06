"use client";

import { useEffect } from "react";
import useLocalStorage from "../lib/useLocalStorage";
import { applyThemePreference, THEME_KEY, type ThemePreference } from "./theme";

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemeSelect() {
  const [theme, setTheme] = useLocalStorage<ThemePreference>(THEME_KEY, "dark");

  useEffect(() => {
    if (theme) {
      applyThemePreference(theme);
    }
  }, [theme]);

  return (
    <div className="stack">
      <label htmlFor="theme-select">Theme</label>
      <select
        id="theme-select"
        value={theme}
        onChange={(event) => setTheme(event.target.value as ThemePreference)}
      >
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

import { useEffect } from "react";
import useLocalStorage from "../lib/useLocalStorage";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_KEY = "blockerRush.theme";

export const applyThemePreference = (value: ThemePreference) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (value === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", value);
  }
};

export const useTheme = () => {
  const [theme, setTheme] = useLocalStorage<ThemePreference>(THEME_KEY, "dark");

  useEffect(() => {
    if (theme) {
      applyThemePreference(theme);
    }
  }, [theme]);

  return [
    theme ?? ("dark" as ThemePreference),
    setTheme as (value: ThemePreference) => void,
  ] as const;
};

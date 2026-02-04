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

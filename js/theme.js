import { THEME_STORAGE_KEY } from "./config.js";

/**
 * @returns {"light" | "dark"}
 */
export function getStoredTheme() {
  try {
    if (localStorage.getItem(THEME_STORAGE_KEY) === "light") return "light";
  } catch {
    /* ignore */
  }
  return "dark";
}

/**
 * @param {"light" | "dark"} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

/**
 * @param {"light" | "dark"} theme
 */
export function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme() {
  const isLight =
    document.documentElement.getAttribute("data-theme") === "light";
  setTheme(isLight ? "dark" : "light");
}

export function initThemeUi() {
  applyTheme(getStoredTheme());
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const sync = () => {
    const light =
      document.documentElement.getAttribute("data-theme") === "light";
    btn.setAttribute("aria-checked", light ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      light ? "Switch to dark mode" : "Switch to light mode"
    );
    btn.title = light ? "Use dark theme" : "Use light theme";
  };

  sync();
  btn.addEventListener("click", () => {
    toggleTheme();
    sync();
  });
}

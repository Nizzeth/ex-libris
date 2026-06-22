// Theme registry + apply helper. Themes are pure CSS (data-theme attribute);
// this module only tracks the list and toggles the attribute + persistence.
export const THEMES = [
  { key: "archive", label: "Clean Archive", blurb: "Parchment & light leather" },
  { key: "tower", label: "Wizard in the Tower", blurb: "Stone, candlelight, arcane" },
  { key: "desk", label: "Desk at the Library", blurb: "Warm wood & banker's lamp" },
  { key: "starship", label: "Sci-Fi Console", blurb: "Brushed metal & laser glow" },
];

const KEY = "exlibris_theme";
export const isTheme = (k) => THEMES.some((t) => t.key === k);

export function applyTheme(key) {
  const theme = isTheme(key) ? key : "archive";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch (e) {
    /* ignore */
  }
  return theme;
}

export function storedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return isTheme(t) ? t : "archive";
  } catch (e) {
    return "archive";
  }
}

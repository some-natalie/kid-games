export const PREFERENCES_KEY = "kid-games.alphabetical-order.preferences";
export const DEFAULT_THEME = "general";

function storageError(error) {
  return error instanceof DOMException || error instanceof SyntaxError;
}

export function loadPreferences(getStorage, themes) {
  try {
    const saved = getStorage().getItem(PREFERENCES_KEY);
    if (saved === null) return { theme: DEFAULT_THEME, warning: "" };
    const preferences = JSON.parse(saved);
    if (!preferences || preferences.version !== 1 || typeof preferences.theme !== "string" ||
        !themes.includes(preferences.theme)) {
      console.warn("Saved Alphabetical Adventure preferences are no longer valid.");
      return { theme: DEFAULT_THEME, warning: "Your saved theme isn't available. Pick a theme below." };
    }
    return { theme: preferences.theme, warning: "" };
  } catch (error) {
    if (!storageError(error)) throw error;
    console.warn("Unable to read Alphabetical Adventure preferences:", error);
    return { theme: DEFAULT_THEME, warning: "We couldn't read your saved theme. You can still choose one and play." };
  }
}

export function savePreferences(getStorage, theme) {
  try {
    getStorage().setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, theme }));
    return "";
  } catch (error) {
    if (!storageError(error)) throw error;
    console.warn("Unable to save Alphabetical Adventure preferences:", error);
    return "Your theme works for now, but this browser couldn't save it for next time.";
  }
}

import { isStorageError } from "./alphabet-preferences.js";

export const PROGRESS_KEY = "kid-games.alphabetical-order.progress";

function readAll(getStorage) {
  const saved = getStorage().getItem(PROGRESS_KEY);
  if (saved === null) return { version: 1, themes: {} };
  const progress = JSON.parse(saved);
  if (!progress || progress.version !== 1 || !progress.themes || typeof progress.themes !== "object" ||
      Array.isArray(progress.themes)) {
    throw new SyntaxError("Saved progress has an unknown format.");
  }
  return progress;
}

function update(getStorage, change) {
  let all;
  try {
    all = readAll(getStorage);
  } catch (error) {
    if (!isStorageError(error)) throw error;
    all = { version: 1, themes: {} };
  }
  change(all.themes);
  getStorage().setItem(PROGRESS_KEY, JSON.stringify(all));
}

// `isValid` checks the saved level against the loaded word bank.
export function loadProgress(getStorage, theme, isValid) {
  try {
    const saved = readAll(getStorage).themes[theme];
    if (saved === undefined) return { progress: undefined, warning: "" };
    if (isValid(saved)) return { progress: saved, warning: "" };
    console.warn("Saved Alphabetical Adventure progress is no longer valid.");
  } catch (error) {
    if (!isStorageError(error)) throw error;
    console.warn("Unable to read Alphabetical Adventure progress:", error);
  }
  return { progress: undefined, warning: "We couldn't restore your saved level, so you'll start fresh." };
}

export function saveProgress(getStorage, theme, progress) {
  try {
    update(getStorage, (themes) => { themes[theme] = progress; });
    return "";
  } catch (error) {
    if (!isStorageError(error)) throw error;
    console.warn("Unable to save Alphabetical Adventure progress:", error);
    return "You can keep playing, but this browser couldn't save your level.";
  }
}

export function clearProgress(getStorage, theme) {
  try {
    update(getStorage, (themes) => { delete themes[theme]; });
    return "";
  } catch (error) {
    if (!isStorageError(error)) throw error;
    console.warn("Unable to clear Alphabetical Adventure progress:", error);
    return "This browser couldn't update your saved level.";
  }
}

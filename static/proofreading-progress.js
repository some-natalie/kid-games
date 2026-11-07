import { isStorageError } from "./alphabet-preferences.js";

export const PROGRESS_KEY = "kid-games.proofreading.progress";

export function loadProgress(getStorage, levelCount) {
  try {
    const saved = getStorage().getItem(PROGRESS_KEY);
    if (saved === null) return { level: undefined, warning: "" };
    const progress = JSON.parse(saved);
    if (progress?.version === 1 && Number.isInteger(progress.level) &&
        progress.level >= 0 && progress.level < levelCount) {
      return { level: progress.level, warning: "" };
    }
    console.warn("Saved Proofreading Detectives progress is no longer valid.");
  } catch (error) {
    if (!isStorageError(error)) throw error;
    console.warn("Unable to read Proofreading Detectives progress:", error);
  }
  return { level: undefined, warning: "We couldn't restore your saved level, so you'll start fresh." };
}

export function saveProgress(getStorage, level) {
  try {
    getStorage().setItem(PROGRESS_KEY, JSON.stringify({ version: 1, level }));
    return "";
  } catch (error) {
    if (!isStorageError(error)) throw error;
    console.warn("Unable to save Proofreading Detectives progress:", error);
    return "You can keep playing, but this browser couldn't save your level.";
  }
}

export function clearProgress(getStorage) {
  try {
    getStorage().removeItem(PROGRESS_KEY);
    return "";
  } catch (error) {
    if (!isStorageError(error)) throw error;
    console.warn("Unable to clear Proofreading Detectives progress:", error);
    return "This browser couldn't update your saved level.";
  }
}

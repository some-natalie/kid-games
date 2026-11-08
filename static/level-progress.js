import { isStorageError } from "./alphabet-preferences.js";

export function createLevelProgress(key, gameName) {
  return {
    loadProgress(getStorage, levelCount) {
      try {
        const saved = getStorage().getItem(key);
        if (saved === null) return { level: undefined, warning: "" };
        const progress = JSON.parse(saved);
        if (progress?.version === 1 && Number.isInteger(progress.level) &&
            progress.level >= 0 && progress.level < levelCount) {
          return { level: progress.level, warning: "" };
        }
        console.warn(`Saved ${gameName} progress is no longer valid.`);
      } catch (error) {
        if (!isStorageError(error)) throw error;
        console.warn(`Unable to read ${gameName} progress:`, error);
      }
      return { level: undefined, warning: "We couldn't restore your saved level, so you'll start fresh." };
    },
    saveProgress(getStorage, level) {
      try {
        getStorage().setItem(key, JSON.stringify({ version: 1, level }));
        return "";
      } catch (error) {
        if (!isStorageError(error)) throw error;
        console.warn(`Unable to save ${gameName} progress:`, error);
        return "You can keep playing, but this browser couldn't save your level.";
      }
    },
    clearProgress(getStorage) {
      try {
        getStorage().removeItem(key);
        return "";
      } catch (error) {
        if (!isStorageError(error)) throw error;
        console.warn(`Unable to clear ${gameName} progress:`, error);
        return "This browser couldn't update your saved level.";
      }
    },
  };
}

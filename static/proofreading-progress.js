import { createLevelProgress } from "./level-progress.js";

export const PROGRESS_KEY = "kid-games.proofreading.progress";

export const { loadProgress, saveProgress, clearProgress } =
  createLevelProgress(PROGRESS_KEY, "Proofreading Detectives");

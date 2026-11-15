import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { createLevelProgress } from "./level-progress.js";
import { isQuizMode } from "./quiz-engine.js";
import {
  LEVELS, blockDescription, blocksForNumber, comparisonExplanation, isLevelComplete, makeBlocks,
} from "./place-value-builders-engine.js";
import { drawBlockColumns, mountBlockWorkspace } from "./place-value-blocks.js";

if (!isQuizMode(window.location.search)) {
  const { loadProgress, saveProgress, clearProgress } =
    createLevelProgress("kid-games.place-value-builders.progress", "Place-Value Builders");
  const storage = () => window.localStorage;
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const status = find("preference-status");
  const feedback = find("feedback");
  const hint = find("place-value-hint");
  let savedLevel;
  let levelIndex = 0;
  let blocks;
  let selectedComparison = "";
  let solved = false;
  let blockEditor;

  function showWarning(message) {
    if (!message) return;
    status.classList.add("warning");
    status.textContent = message;
  }

  function drawMap() {
    find("level-map").replaceChildren(...LEVELS.map((level, index) => {
      const item = document.createElement("li");
      item.textContent = String(index + 1);
      item.className = index < levelIndex ? "done" : index === levelIndex ? "current" : "";
      item.setAttribute("aria-label", `Level ${index + 1}: ${level.title}${index < levelIndex ? ", finished" : ""}`);
      if (index === levelIndex) item.setAttribute("aria-current", "step");
      return item;
    }));
  }

  function drawBlocks() {
    blockEditor?.destroy();
    blockEditor = mountBlockWorkspace(find("block-workspace"), {
      initial: blocks,
      readout: find("number-readout"),
      onChange(value) {
        blocks = value;
        feedback.textContent = "";
        hint.hidden = true;
      },
    });
    blockEditor.setDisabled(solved);
  }

  function drawComparison(level) {
    const models = find("comparison-models");
    models.replaceChildren();
    for (const [label, value, side] of [["First number", level.left, "left"], ["Second number", level.right, "right"]]) {
      const model = document.createElement("section");
      model.className = "comparison-model";
      const heading = document.createElement("h3");
      heading.textContent = `${label}: ${value}`;
      const columns = document.createElement("div");
      columns.className = "place-value-workspace";
      drawBlockColumns(columns, blocksForNumber(value));
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "secondary-button";
      choose.textContent = `Choose ${value}`;
      choose.setAttribute("aria-pressed", String(selectedComparison === side));
      choose.setAttribute("aria-label", `Choose ${value}`);
      choose.disabled = solved;
      choose.addEventListener("click", () => {
        selectedComparison = side;
        feedback.textContent = "";
        drawComparison(level);
        models.querySelector(`[aria-label="Choose ${value}"]`)?.focus();
      });
      model.append(heading, columns, choose);
      models.append(model);
    }
  }

  function showHint() {
    hint.hidden = false;
    hint.textContent = LEVELS[levelIndex].hint;
  }

  function check() {
    if (solved) return;
    const level = LEVELS[levelIndex];
    if (isLevelComplete(levelIndex, blocks, selectedComparison)) {
      solved = true;
      feedback.className = "feedback success";
      const explanation = level.type === "build"
        ? `${level.target} is ${blockDescription(blocks)}.`
        : comparisonExplanation(level.left, level.right);
      const { message } = celebrate(GAME_CELEBRATIONS["place-value-builders"]);
      feedback.textContent = `${message} ${explanation}`;
      hint.hidden = true;
      find("check-build").hidden = true;
      const next = find("next-level");
      next.textContent = levelIndex === LEVELS.length - 1 ? "Finish building" : "Next level";
      next.hidden = false;
      showWarning(saveProgress(storage, levelIndex));
      if (level.type === "build") drawBlocks();
      else drawComparison(level);
      next.focus();
      return;
    }
    feedback.className = "feedback";
    feedback.textContent = level.type === "build"
      ? "Not quite yet. Keep building and regrouping; you can try as many times as you need."
      : "Choose the greater quantity. Compare the place values and try again.";
    showHint();
  }

  function startLevel(index) {
    blockEditor?.destroy();
    blockEditor = undefined;
    levelIndex = index;
    blocks = LEVELS[index].type === "build"
      ? LEVELS[index].start
      : makeBlocks();
    selectedComparison = "";
    solved = false;
    stopCelebration();
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    document.body.classList.add("is-playing");
    feedback.className = "feedback";
    feedback.textContent = "";
    hint.hidden = true;
    find("check-build").hidden = false;
    find("next-level").hidden = true;
    find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
    find("level-title").textContent = LEVELS[index].title;
    find("level-instructions").textContent = LEVELS[index].instructions;
    find("build-area").hidden = LEVELS[index].type !== "build";
    find("comparison-area").hidden = LEVELS[index].type !== "compare";
    drawMap();
    if (LEVELS[index].type === "build") drawBlocks();
    else drawComparison(LEVELS[index]);
    find("level-title").focus();
  }

  function finish() {
    stopCelebration();
    showWarning(clearProgress(storage));
    savedLevel = undefined;
    playArea.hidden = true;
    finale.hidden = false;
    document.body.classList.remove("is-playing");
    celebrate(GAME_CELEBRATIONS["place-value-builders"]);
    find("quest-heading").focus();
  }

  find("start-game").addEventListener("click", () => startLevel(savedLevel ?? 0));
  find("new-quest").addEventListener("click", () => {
    showWarning(clearProgress(storage));
    savedLevel = undefined;
    startLevel(0);
  });
  find("check-build").addEventListener("click", check);
  find("show-hint").addEventListener("click", showHint);
  find("next-level").addEventListener("click", () => {
    if (levelIndex === LEVELS.length - 1) finish();
    else startLevel(levelIndex + 1);
  });
  find("play-again").addEventListener("click", () => {
    showWarning(clearProgress(storage));
    savedLevel = undefined;
    startLevel(0);
  });

  const progress = loadProgress(storage, LEVELS.length);
  savedLevel = progress.level;
  showWarning(progress.warning);
  if (savedLevel !== undefined) {
    find("start-game").textContent = `Continue level ${savedLevel + 1}`;
    find("new-quest").hidden = false;
  }
}

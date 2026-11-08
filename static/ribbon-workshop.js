import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { createLevelProgress } from "./level-progress.js";
import { isQuizMode } from "./quiz-engine.js";
import {
  LEVELS, PARTITIONS, checkExercise, fractionDescription, fractionLabel, partitionRibbon,
} from "./ribbon-workshop-engine.js";

if (!isQuizMode(window.location.search)) {
  const { loadProgress, saveProgress, clearProgress } =
    createLevelProgress("kid-games.ribbon-workshop.progress", "Ribbon Workshop");
  const storage = () => window.localStorage;
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const status = find("preference-status");
  const feedback = find("feedback");
  const hint = find("ribbon-hint");
  const overlayToggle = find("overlay-toggle");
  const overlayVisual = find("overlay-visual");
  let levelIndex = 0;
  let selections = [];
  let solved = false;
  let overlayShown = false;

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

  function taskDescription(level) {
    if (level.type === "select") return `Select ${fractionDescription(level.target)}.`;
    if (level.type === "equivalent") return `Show ${fractionLabel(level.target)} on both ribbons.`;
    if (level.type === "compare") return `Compare ${fractionLabel(level.target)} and ${fractionLabel(level.other)}.`;
    return `Complete one whole from ${fractionLabel(level.target)}.`;
  }

  function updateProgress() {
    const level = LEVELS[levelIndex];
    find("ribbon-progress").textContent = selections.map((selection, index) => {
      const numerator = selection.selected.length;
      const fraction = `${numerator}/${selection.denominator}`;
      if (level.type === "complete" && index === 0) return `Ribbon 1: ${fraction} already selected.`;
      return `Ribbon ${index + 1}: ${fraction} selected (${numerator} of ${selection.denominator} equal parts).`;
    }).join(" ");
  }

  function makeSvgElement(name, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, String(value));
    return node;
  }

  function drawOverlay() {
    const level = LEVELS[levelIndex];
    const description = find("overlay-description");
    overlayToggle.setAttribute("aria-pressed", String(overlayShown));
    overlayToggle.textContent = overlayShown ? "Hide aligned overlay" : "Show aligned overlay";
    overlayVisual.toggleAttribute("hidden", !overlayShown);
    description.hidden = !overlayShown;
    if (!overlayShown) return;

    overlayVisual.replaceChildren();
    const definitions = makeSvgElement("defs");
    for (const [index, path] of [
      "M0 6 L6 0",
      "M0 0 L6 6 M6 0 L0 6",
    ].entries()) {
      const pattern = makeSvgElement("pattern", { id: `ribbon-pattern-${index}`, width: 6, height: 6, patternUnits: "userSpaceOnUse" });
      pattern.append(makeSvgElement("path", { d: path, stroke: "currentColor", "stroke-width": 1.5 }));
      definitions.append(pattern);
    }
    overlayVisual.append(definitions);
    selections.forEach((selection, index) => {
      const y = index * 22 + 2;
      overlayVisual.append(makeSvgElement("rect", {
        x: 0, y, width: 100, height: 16, rx: 2, fill: "var(--badge)", stroke: "currentColor", "stroke-width": 0.8,
      }));
      for (const part of selection.selected) {
        overlayVisual.append(makeSvgElement("rect", {
          x: 100 * part / selection.denominator, y, width: 100 / selection.denominator, height: 16,
          fill: `url(#ribbon-pattern-${index})`, stroke: "currentColor", "stroke-width": 0.8,
        }));
      }
      for (let part = 1; part < selection.denominator; part += 1) {
        const x = 100 * part / selection.denominator;
        overlayVisual.append(makeSvgElement("line", {
          x1: x, x2: x, y1: y - 1, y2: y + 17, stroke: "currentColor", "stroke-width": 0.8,
          "stroke-dasharray": index === 1 ? "2 1" : "none",
        }));
      }
    });

    const amounts = selections.map(({ denominator, selected }) => fractionDescription({
      numerator: selected.length, denominator,
    }));
    description.textContent = `Aligned at the same left edge; both ribbons have the same whole length. ${amounts.map((amount, index) =>
      `Ribbon ${index + 1}: ${amount}.`).join(" ")}`;
    if (level.type === "equivalent") description.textContent += " The selected lengths can be compared from their shared origin.";
  }

  function drawRibbons(focus) {
    const level = LEVELS[levelIndex];
    const boards = find("ribbon-boards");
    boards.replaceChildren(...selections.map((selection, ribbonIndex) => {
      const board = document.createElement("section");
      board.className = "ribbon-board";
      board.dataset.ribbon = String(ribbonIndex);
      const heading = document.createElement("h3");
      heading.textContent = `Ribbon ${ribbonIndex + 1}`;
      const controls = document.createElement("fieldset");
      controls.className = "ribbon-fold-controls";
      const legend = document.createElement("legend");
      legend.textContent = level.type === "complete" && ribbonIndex === 0
        ? "Already selected" : `Fold ribbon ${ribbonIndex + 1} into equal parts`;
      controls.append(legend);
      if (level.type === "complete" && ribbonIndex === 0) {
        const fixed = document.createElement("p");
        fixed.textContent = `${fractionLabel(level.target)} is already selected.`;
        controls.append(fixed);
      } else {
        const allowed = level.type === "complete" ? [level.target.denominator] : PARTITIONS;
        for (const denominator of allowed) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary-button ribbon-fold-button";
          button.textContent = `${denominator} parts`;
          button.setAttribute("aria-label", `Fold ribbon ${ribbonIndex + 1} into ${denominator} equal parts`);
          button.setAttribute("aria-pressed", String(selection.denominator === denominator));
          button.addEventListener("click", () => {
            if (solved) return;
            selection.denominator = denominator;
            selection.selected = [];
            feedback.textContent = "";
            hint.hidden = true;
            drawAll();
            boards.querySelector(`[data-ribbon="${ribbonIndex}"] .ribbon-fold-button[aria-pressed="true"]`)?.focus();
          });
          controls.append(button);
        }
      }
      const parts = document.createElement("div");
      parts.className = "ribbon-segments";
      parts.setAttribute("role", "img");
      parts.setAttribute("aria-label",
        `Ribbon ${ribbonIndex + 1}: ${fractionDescription({ numerator: selection.selected.length, denominator: selection.denominator })} selected.`);
      for (const { index } of partitionRibbon(selection.denominator)) {
        const part = document.createElement("span");
        part.className = `ribbon-part${selection.selected.includes(index) ? " ribbon-selected" : ""}`;
        part.textContent = String(index + 1);
        parts.append(part);
      }
      const adjustments = document.createElement("div");
      adjustments.className = "ribbon-select-controls";
      if (!(level.type === "complete" && ribbonIndex === 0)) {
        for (const [action, label, amount] of [
          ["remove", "Remove one selected part", -1],
          ["add", "Select one more part", 1],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "secondary-button";
          button.textContent = label;
          button.setAttribute("aria-label", `${label} on ribbon ${ribbonIndex + 1}`);
          button.dataset.adjust = action;
          button.disabled = solved || selection.selected.length + amount < 0 ||
            selection.selected.length + amount > selection.denominator;
          button.addEventListener("click", () => {
            if (solved) return;
            const count = selection.selected.length + amount;
            const offset = level.type === "complete" && ribbonIndex === 1 ? level.target.numerator : 0;
            selection.selected = Array.from({ length: count }, (_, index) => index + offset);
            feedback.textContent = "";
            hint.hidden = true;
            drawAll();
            boards.querySelector(`[data-ribbon="${ribbonIndex}"] [data-adjust="${action}"]`)?.focus();
          });
          adjustments.append(button);
        }
      }
      const quantity = document.createElement("p");
      quantity.className = "ribbon-quantity";
      quantity.textContent = level.type === "complete" && ribbonIndex === 0
        ? `Ribbon 1: ${fractionDescription(level.target)} already selected.`
        : `Ribbon ${ribbonIndex + 1}: ${fractionDescription({ numerator: selection.selected.length, denominator: selection.denominator })} selected.`;
      board.append(heading, controls, parts, adjustments, quantity);
      return board;
    }));
    find("overlay-panel").hidden = selections.length < 2;
    updateProgress();
    drawOverlay();
  }

  function drawAll() {
    drawRibbons();
  }

  function showHint() {
    hint.hidden = false;
    hint.textContent = LEVELS[levelIndex].hint;
  }

  function successMessage(level) {
    if (level.type === "select") return `${fractionLabel(level.target)} is selected as equal ribbon parts.`;
    if (level.type === "equivalent") {
      return `${fractionLabel(level.target)} has the same length on both ribbons.`;
    }
    if (level.type === "compare") {
      return `${fractionLabel(level.target)} is longer than ${fractionLabel(level.other)}.`;
    }
    return `${fractionLabel(level.target)} plus the missing parts completes one whole.`;
  }

  function check() {
    if (solved) return;
    if (checkExercise(levelIndex, selections)) {
      solved = true;
      feedback.className = "feedback success";
      const { message: cheer } = celebrate(GAME_CELEBRATIONS["ribbon-workshop"]);
      feedback.textContent = `${cheer} ${successMessage(LEVELS[levelIndex])}`;
      hint.hidden = true;
      find("check-ribbons").hidden = true;
      const next = find("next-level");
      next.textContent = levelIndex === LEVELS.length - 1 ? "Finish workshop" : "Next level";
      next.hidden = false;
      showWarning(saveProgress(storage, levelIndex));
      drawAll();
      next.focus();
      return;
    }
    feedback.className = "feedback";
    feedback.textContent = "Not quite yet. Try another fold or selection; there is no timer and no points are lost.";
    showHint();
  }

  function startLevel(index) {
    levelIndex = index;
    solved = false;
    overlayShown = false;
    stopCelebration();
    const level = LEVELS[index];
    selections = level.ribbons.map(({ denominator }, ribbonIndex) => ({
      denominator,
      selected: level.type === "complete" && ribbonIndex === 0
        ? Array.from({ length: level.target.numerator }, (_, part) => part) : [],
    }));
    document.body.classList.add("is-playing");
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    feedback.className = "feedback";
    feedback.textContent = "";
    hint.textContent = "";
    hint.hidden = true;
    find("check-ribbons").hidden = false;
    find("next-level").hidden = true;
    showWarning(saveProgress(storage, index));
    drawMap();
    find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
    find("level-title").textContent = level.title;
    find("level-instructions").textContent = level.instructions;
    find("fraction-target").textContent = taskDescription(level);
    drawAll();
    find("level-title").focus();
  }

  function restart() {
    showWarning(clearProgress(storage));
    startLevel(0);
  }

  find("start-game").addEventListener("click", () => {
    const saved = loadProgress(storage, LEVELS.length);
    showWarning(saved.warning);
    startLevel(saved.level ?? 0);
  });
  find("new-quest").addEventListener("click", restart);
  find("play-again").addEventListener("click", restart);
  find("show-hint").addEventListener("click", showHint);
  find("check-ribbons").addEventListener("click", check);
  find("next-level").addEventListener("click", () => {
    if (!solved) return;
    if (levelIndex < LEVELS.length - 1) startLevel(levelIndex + 1);
    else {
      showWarning(clearProgress(storage));
      playArea.hidden = true;
      finale.hidden = false;
      find("quest-heading").focus();
      celebrate(GAME_CELEBRATIONS["ribbon-workshop"]);
    }
  });
  overlayToggle.addEventListener("click", () => {
    overlayShown = !overlayShown;
    drawOverlay();
  });

  const saved = loadProgress(storage, LEVELS.length);
  showWarning(saved.warning);
  if (saved.level !== undefined) {
    find("start-game").textContent = `Continue level ${saved.level + 1}`;
    find("new-quest").hidden = false;
  }
}

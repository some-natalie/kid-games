import {
  LEVELS, PUZZLES_PER_LEVEL, buildPuzzle, fractionText, hintText, matchesAnswer,
} from "./picnic-pizza-engine.js";
import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { createLevelProgress } from "./level-progress.js";
import { isQuizMode } from "./quiz-engine.js";

if (!isQuizMode(window.location.search)) {
  const { loadProgress, saveProgress, clearProgress } =
    createLevelProgress("kid-games.picnic-pizza.progress", "Picnic Pizza");
  const getStorage = () => window.localStorage;
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const status = find("preference-status");
  const controls = find("piece-controls");
  const visuals = find("puzzle-visuals");
  const checkButton = find("check-answer");
  const nextButton = find("next-step");
  let levelIndex = 0;
  let puzzleIndex = 0;
  let puzzle;
  let selected = new Set();
  let answered = false;

  function showWarning(warning) {
    if (!warning) return;
    status.classList.add("warning");
    status.textContent = warning;
  }

  function partLabel(visual) {
    const equal = visual.areas.every((area) => area === visual.areas[0]);
    const served = visual.selected.length;
    return `${visual.areas.length} ${equal ? "equal pieces" : "unequal pieces"}; ${served} ${served === 1 ? "piece is" : "pieces are"} selected.`;
  }

  function addCircle(whole, visual) {
    const total = visual.areas.reduce((sum, area) => sum + area, 0);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    let start = -Math.PI / 2;
    visual.areas.forEach((area, index) => {
      const end = start + Math.PI * 2 * area / total;
      const point = (angle) => [50 + 46 * Math.cos(angle), 50 + 46 * Math.sin(angle)];
      const [x1, y1] = point(start);
      const [x2, y2] = point(end);
      const large = end - start > Math.PI ? 1 : 0;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M 50 50 L ${x1} ${y1} A 46 46 0 ${large} 1 ${x2} ${y2} Z`);
      path.setAttribute("class", visual.selected.includes(index) ? "served" : "");
      svg.append(path);
      start = end;
    });
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    outline.setAttribute("cx", "50");
    outline.setAttribute("cy", "50");
    outline.setAttribute("r", "46");
    outline.setAttribute("class", "whole-outline");
    svg.append(outline);
    whole.append(svg);
  }

  function makeWhole(shape, visual, label) {
    const whole = document.createElement("div");
    whole.className = `fraction-whole ${shape}`;
    whole.setAttribute("role", "img");
    whole.setAttribute("aria-label", `${label}. ${partLabel(visual)}`);
    if (shape === "circle") {
      addCircle(whole, visual);
    } else {
      const total = visual.areas.reduce((sum, area) => sum + area, 0);
      visual.areas.forEach((area, index) => {
        const part = document.createElement("span");
        part.className = visual.selected.includes(index) ? "served" : "";
        part.style.flexGrow = String(area / total);
        whole.append(part);
      });
    }
    return whole;
  }

  function updateVisual() {
    if (!puzzle.visual || puzzle.activity === "equivalent") return;
    const visual = {
      ...puzzle.visual,
      selected: puzzle.activity === "complete"
        ? [...puzzle.visual.selected, ...selected] : [...selected],
    };
    const chart = visuals.querySelector(".fraction-whole");
    if (chart) {
      const replacement = makeWhole(puzzle.shape, visual, puzzle.food);
      chart.replaceWith(replacement);
    }
    for (const button of controls.querySelectorAll("[data-piece]")) {
      const piece = Number(button.dataset.piece);
      const served = puzzle.activity === "complete" && puzzle.visual.selected.includes(piece);
      button.setAttribute("aria-pressed", String(served || selected.has(piece)));
      button.disabled = served || answered;
    }
  }

  function renderPortionControls() {
    controls.replaceChildren();
    puzzle.visual.areas.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button fraction-piece";
      button.dataset.piece = String(index);
      const served = puzzle.activity === "complete" && puzzle.visual.selected.includes(index);
      button.textContent = `Piece ${index + 1}`;
      button.setAttribute("aria-label", `Piece ${index + 1} of ${puzzle.denominator}${served ? ", already served" : ""}`);
      button.setAttribute("aria-pressed", String(served));
      button.disabled = served;
      button.addEventListener("click", () => {
        if (answered) return;
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);
        button.setAttribute("aria-pressed", String(selected.has(index) || served));
        if (puzzle.activity === "complete") {
          const currentVisual = {
            ...puzzle.visual,
            selected: [...puzzle.visual.selected, ...selected],
          };
          const chart = visuals.querySelector(".fraction-whole");
          chart.replaceWith(makeWhole(puzzle.shape, currentVisual, puzzle.food));
        } else {
          const chart = visuals.querySelector(".fraction-whole");
          chart.replaceWith(makeWhole(puzzle.shape, { ...puzzle.visual, selected: [...selected] }, puzzle.food));
        }
      });
      controls.append(button);
    });
    find("piece-instructions").textContent = puzzle.activity === "complete"
      ? "Tap the piece or pieces that will fill the visible gap."
      : `Tap exactly ${puzzle.numerator} of the ${puzzle.denominator} equal pieces. Tap again to unselect.`;
    updateVisual();
  }

  function renderDiagram(visual, shape, label, parent = visuals) {
    const whole = makeWhole(shape, visual, label);
    parent.append(whole);
    return whole;
  }

  function renderFractionChoices() {
    const labels = puzzle.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button fraction-answer";
      button.value = choice;
      if (puzzle.activity === "equivalent") {
        const [numerator, denominator] = choice.split("/").map(Number);
        button.classList.add("fraction-choice");
        const preview = document.createElement("span");
        preview.className = "fraction-preview";
        const visual = {
          areas: Array(denominator).fill(1),
          denominator,
          selected: Array.from({ length: numerator }, (_, index) => index),
        };
        renderDiagram(visual, puzzle.shape, `Preview of ${choice}`, preview);
        const text = document.createElement("span");
        text.textContent = fractionText(numerator, denominator);
        button.append(preview, text);
        button.setAttribute("aria-label", `${fractionText(numerator, denominator)}; select this fraction`);
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          if (answered) return;
          if (selected.has(choice)) selected.delete(choice);
          else selected.add(choice);
          button.setAttribute("aria-pressed", String(selected.has(choice)));
        });
      } else {
        const compared = puzzle.comparison?.[choice === "A" ? 0 : 1];
        const label = puzzle.activity === "compare"
          ? `${choice}: ${fractionText(compared.numerator, compared.denominator)}`
          : puzzle.activity === "name" ? fractionText(...choice.split("/").map(Number))
            : choice === "equal" ? "Equal shares" : "Unequal shares";
        button.textContent = label;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", () => submit(choice));
      }
      return button;
    });
    controls.replaceChildren(...labels);
    find("piece-instructions").textContent = puzzle.activity === "equivalent"
      ? "Choose both fractions that cover the same amount, then check your answer."
      : "Choose the best answer. You may try again if it is not right yet.";
  }

  function drawPuzzle() {
    puzzle = buildPuzzle(levelIndex, puzzleIndex);
    selected = new Set();
    answered = false;
    stopCelebration();
    find("puzzle-heading").textContent = `Picnic puzzle ${puzzleIndex + 1}`;
    find("puzzle-prompt").textContent = puzzle.prompt;
    find("feedback").textContent = "";
    find("feedback").classList.remove("success");
    find("hint").hidden = true;
    find("hint").textContent = "";
    find("show-hint").hidden = false;
    checkButton.hidden = !["build", "complete", "equivalent"].includes(puzzle.activity);
    nextButton.hidden = true;
    nextButton.textContent = puzzleIndex < PUZZLES_PER_LEVEL - 1
      ? "Next puzzle" : levelIndex < LEVELS.length - 1 ? "Next level" : "Finish picnic";
    visuals.replaceChildren();
    if (["equal", "name", "build", "complete"].includes(puzzle.activity)) {
      renderDiagram(puzzle.visual, puzzle.shape, puzzle.food);
    } else if (puzzle.activity === "compare") {
      const pair = document.createElement("div");
      pair.className = "fraction-comparison";
      puzzle.comparison.forEach(({ numerator, denominator }, index) => {
        const panel = document.createElement("div");
        const letter = index === 0 ? "A" : "B";
        const label = fractionText(numerator, denominator);
        const title = document.createElement("strong");
        title.textContent = `${letter}: ${label}`;
        panel.append(title, makeWhole(puzzle.shape, {
          areas: Array(denominator).fill(1),
          denominator,
          selected: Array.from({ length: numerator }, (_, piece) => piece),
        }, `Same-size whole ${letter}; ${label} selected.`));
        pair.append(panel);
      });
      visuals.append(pair);
    } else if (puzzle.activity === "equivalent") {
      const target = document.createElement("div");
      target.className = "fraction-target";
      const text = document.createElement("strong");
      text.textContent = "Reference: one half (1/2)";
      target.append(text, makeWhole(puzzle.shape, {
        areas: [1, 1], denominator: 2, selected: [0],
      }, "Same-size reference whole; one half selected."));
      visuals.append(target);
    }
    if (["build", "complete"].includes(puzzle.activity)) renderPortionControls();
    else renderFractionChoices();
    find("progress").textContent = `Puzzle ${puzzleIndex + 1} of ${PUZZLES_PER_LEVEL} in this level.`;
  }

  function drawMap() {
    find("level-map").replaceChildren(...LEVELS.map((level, index) => {
      const item = document.createElement("li");
      item.textContent = String(index + 1);
      item.setAttribute("aria-label", `Level ${index + 1}: ${level.title}${index < levelIndex ? ", finished" : ""}`);
      item.className = index < levelIndex ? "done" : index === levelIndex ? "current" : "";
      if (index === levelIndex) item.setAttribute("aria-current", "step");
      return item;
    }));
  }

  function submit(response) {
    if (answered) return;
    const answer = response ?? [...selected];
    if (!matchesAnswer(puzzle, answer)) {
      find("feedback").classList.remove("success");
      find("feedback").textContent = puzzle.activity === "build"
        ? `You selected ${selected.size} pieces. Look at the requested fraction and try again.`
        : puzzle.activity === "complete"
          ? "Those pieces do not fill the whole yet. Look for the remaining gap and try again."
          : "That does not match the picture yet. Try another answer.";
      showHint();
      return;
    }
    answered = true;
    const { message: cheer } = celebrate(GAME_CELEBRATIONS["picnic-pizza"]);
    find("feedback").classList.add("success");
    find("feedback").textContent = `${cheer} ` + (puzzle.activity === "equal"
      ? puzzle.expected === "equal"
        ? "Equal shares have the same area."
        : "These pieces are unequal, so they are not equal shares of the whole."
      : puzzle.activity === "name"
        ? `${fractionText(puzzle.numerator, puzzle.denominator)}. The denominator counts all equal pieces; the numerator counts the selected pieces.`
        : puzzle.activity === "build"
          ? `You served ${fractionText(puzzle.numerator, puzzle.denominator)}.`
          : puzzle.activity === "compare"
            ? `Both are the same-size whole, and ${puzzle.expected} covers more.`
            : puzzle.activity === "equivalent"
              ? "They match: one half = two fourths = four eighths; each covers the same amount."
              : "The missing piece fills the gap. Now all four equal pieces make one whole!");
    find("hint").hidden = true;
    find("show-hint").hidden = true;
    checkButton.hidden = true;
    for (const button of controls.querySelectorAll("button")) button.disabled = true;
    if (puzzleIndex === PUZZLES_PER_LEVEL - 1 && levelIndex < LEVELS.length - 1) {
      showWarning(saveProgress(getStorage, levelIndex + 1));
    }
    nextButton.hidden = false;
    nextButton.focus();
  }

  function showHint() {
    const hint = find("hint");
    hint.hidden = false;
    hint.textContent = hintText(puzzle);
  }

  function startLevel(index) {
    levelIndex = index;
    puzzleIndex = 0;
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    drawMap();
    find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
    find("level-title").textContent = LEVELS[index].title;
    const instructions = {
      equal: "Look closely at the area of each piece. Equal shares must be the same size.",
      name: "Read the denominator for all equal pieces and the numerator for selected pieces.",
      build: "Tap equal pieces to make the fraction shown. You may unselect a piece before checking.",
      compare: "Compare the amounts on identical-size wholes.",
      equivalent: "Select each fraction that covers the same amount as the reference.",
      complete: "Use the picture to find the missing part of the whole.",
    };
    find("level-instructions").textContent = instructions[LEVELS[index].activity];
    showWarning(saveProgress(getStorage, index));
    drawPuzzle();
    find("level-title").focus();
  }

  function finish() {
    showWarning(clearProgress(getStorage));
    playArea.hidden = true;
    finale.hidden = false;
    find("quest-heading").focus();
    celebrate(GAME_CELEBRATIONS["picnic-pizza"]);
  }

  function advance() {
    if (!answered) return;
    if (puzzleIndex < PUZZLES_PER_LEVEL - 1) {
      puzzleIndex += 1;
      drawPuzzle();
      find("puzzle-heading").focus();
    } else if (levelIndex < LEVELS.length - 1) {
      startLevel(levelIndex + 1);
    } else {
      finish();
    }
  }

  find("start-game").addEventListener("click", () => {
    const progress = loadProgress(getStorage, LEVELS.length);
    showWarning(progress.warning);
    startLevel(progress.level ?? 0);
  });
  find("new-quest").addEventListener("click", () => {
    showWarning(clearProgress(getStorage));
    startLevel(0);
  });
  find("play-again").addEventListener("click", () => startLevel(0));
  find("show-hint").addEventListener("click", showHint);
  checkButton.addEventListener("click", () => submit());
  nextButton.addEventListener("click", advance);

  const saved = loadProgress(getStorage, LEVELS.length);
  showWarning(saved.warning);
  if (saved.level !== undefined) {
    find("start-game").textContent = `Continue level ${saved.level + 1}`;
    find("new-quest").hidden = false;
  }
}

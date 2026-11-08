import {
  LEVELS, compareFractions, evaluatePlacement, fractionName, isOrdered, positionLabel,
} from "./fraction-bridge-engine.js";
import { createBridgeLine, createTargetCard } from "./fraction-bridge-line.js";
import { createLevelProgress } from "./level-progress.js";
import { isQuizMode } from "./quiz-engine.js";

if (!isQuizMode(window.location.search)) {
  const { loadProgress, saveProgress, clearProgress } =
    createLevelProgress("kid-games.fraction-bridge.progress", "Fraction Bridge");
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const challengeArea = find("challenge-area");
  const feedback = find("feedback");
  const hint = find("fraction-hint");
  const hintButton = find("show-hint");
  const nextButton = find("next-level");
  const storageStatus = find("preference-status");
  const getStorage = () => window.localStorage;
  const progress = loadProgress(getStorage, LEVELS.length);
  let levelIndex = 0;
  let solved = false;
  let hintShown = false;
  let currentOrder = [];
  let bridge;

  function showWarning(message) {
    if (!message) return;
    storageStatus.classList.add("warning");
    storageStatus.textContent = message;
  }

  function button(label, className = "secondary-button") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    return node;
  }

  function drawLevelMap() {
    find("level-map").replaceChildren(...LEVELS.map((level, index) => {
      const item = document.createElement("li");
      item.textContent = String(index + 1);
      item.setAttribute("aria-label", `Level ${index + 1}: ${level.title}${index < levelIndex ? ", finished" : ""}`);
      if (index < levelIndex) item.className = "done";
      if (index === levelIndex) {
        item.className = "current";
        item.setAttribute("aria-current", "step");
      }
      return item;
    }));
  }

  function check(level, tick) {
    if (solved) return;
    const label = positionLabel(tick, level.intervals);
    if (!evaluatePlacement(level.fractions, tick, level.intervals)) {
      feedback.textContent = `${label} is not the right spot yet. Try again.`;
      return;
    }
    const target = level.fractions.map((fraction) => `${fraction} (${fractionName(fraction)})`).join(" and ");
    finishLevel(`Yes! ${target} ${level.fractions.length > 1 ? "share this spot" : "belongs here"}.`);
  }

  function showAnswerControls(level) {
    bridge = createBridgeLine({
      keyboardHelp: "Use the arrow keys to move Tilly, then press Enter or Space to check her spot.",
      intervals: level.intervals,
      guides: level.guide,
      onMove: () => { feedback.textContent = ""; },
      onChoose: (tick) => check(level, tick),
    });
    const checkButton = button("Check Tilly’s spot");
    checkButton.addEventListener("click", () => check(level, bridge.tick));
    challengeArea.append(createTargetCard(level.fractions), bridge.element, checkButton);
  }

  function showOrdering(level) {
    currentOrder = [...level.fractions];
    const title = document.createElement("h3");
    title.id = "fraction-order-heading";
    title.textContent = "Arrange from least to greatest";
    const list = document.createElement("ol");
    list.className = "fraction-order-list";
    list.setAttribute("aria-labelledby", title.id);
    function render(focusIndex, direction) {
      list.replaceChildren(...currentOrder.map((fraction, index) => {
        const item = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = `${fraction} (${fractionName(fraction)})`;
        item.append(name);
        for (const [label, delta] of [["Up", -1], ["Down", 1]]) {
          const move = button(label, "secondary-button fraction-move");
          move.setAttribute("aria-label", `Move ${fraction} ${label.toLowerCase()}`);
          move.disabled = solved || index + delta < 0 || index + delta >= currentOrder.length;
          move.addEventListener("click", () => {
            [currentOrder[index], currentOrder[index + delta]] = [currentOrder[index + delta], currentOrder[index]];
            render(index + delta, label);
          });
          item.append(move);
        }
        return item;
      }));
      if (focusIndex !== undefined) {
        const item = list.children[focusIndex];
        const target = item.querySelector(`button[aria-label$="${direction.toLowerCase()}"]`);
        (target.disabled ? item.querySelector("button:not(:disabled)") : target).focus();
      }
    }
    render();
    const check = button("Check order", "primary-button");
    check.addEventListener("click", () => {
      if (solved) return;
      if (isOrdered(currentOrder)) {
        finishLevel(`That's right! ${currentOrder.map((fraction) => `${fraction} (${fractionName(fraction)})`).join(", ")} are in order.`);
      } else {
        feedback.textContent = "Not quite. Compare how far each fraction is from 0, then try another order.";
      }
    });
    challengeArea.append(title, list, check);
  }

  function showComparison(level) {
    const [first, second] = level.fractions;
    const title = document.createElement("h3");
    title.id = "fraction-compare-heading";
    title.textContent = `Which is greater: ${first} or ${second}?`;
    const group = document.createElement("div");
    group.className = "fraction-position-grid";
    group.setAttribute("role", "group");
    group.setAttribute("aria-labelledby", title.id);
    level.fractions.forEach((fraction) => {
      const choice = button(`${fraction} (${fractionName(fraction)})`, "secondary-button fraction-position");
      choice.addEventListener("click", () => {
        if (solved) return;
        if (compareFractions(fraction, level.fractions[0]) > 0) {
          finishLevel(`Yes! ${fraction} (${fractionName(fraction)}) is greater because it is farther from 0.`);
        } else {
          feedback.textContent = `${fraction} is not greater yet. Compare the two positions and try again.`;
        }
      });
      group.append(choice);
    });
    bridge = createBridgeLine({ intervals: level.intervals, guides: false, interactive: false });
    challengeArea.append(title, bridge.element, group);
  }

  function showHint(level) {
    hintShown = !hintShown;
    hint.hidden = !hintShown;
    hintButton.textContent = hintShown ? "Hide hint" : "Show hint";
    if (hintShown) {
      hint.textContent = level.mode === "order"
        ? "Fractions closer to 0 are smaller. If the denominators differ, compare equal-sized parts of the same whole."
        : level.mode === "compare"
          ? "The whole bridge stays the same length. The fraction farther from 0 is greater."
          : `The denominator in ${level.fractions.join(" and ")} tells how many equal intervals make 1 whole. Count intervals from 0; the denominator is not the number of tick marks. The numerator tells how many intervals to count.`;
    }
    bridge?.setGuides(level.guide || hintShown);
  }

  function finishLevel(message) {
    solved = true;
    feedback.textContent = message;
    challengeArea.querySelectorAll("button").forEach((choice) => { choice.disabled = true; });
    bridge?.disable();
    hint.hidden = true;
    hintButton.hidden = true;
    nextButton.textContent = levelIndex === LEVELS.length - 1 ? "Finish bridge" : "Next level";
    nextButton.hidden = false;
    if (levelIndex < LEVELS.length - 1) showWarning(saveProgress(getStorage, levelIndex + 1));
    nextButton.focus();
  }

  function showLevel(focusHeading = false) {
    const level = LEVELS[levelIndex];
    solved = false;
    hintShown = false;
    currentOrder = [];
    bridge = undefined;
    feedback.textContent = "";
    hint.textContent = "";
    hint.hidden = true;
    hintButton.hidden = false;
    hintButton.textContent = "Show hint";
    nextButton.hidden = true;
    challengeArea.replaceChildren();
    drawLevelMap();
    find("level-count").textContent = `Level ${levelIndex + 1} of ${LEVELS.length}`;
    find("level-title").textContent = level.title;
    find("level-instructions").textContent = level.instructions;
    find("progress").textContent = `Level ${levelIndex + 1} of ${LEVELS.length}.`;
    if (level.mode === "place" || level.mode === "equivalent") showAnswerControls(level);
    if (level.mode === "order") showOrdering(level);
    if (level.mode === "compare") showComparison(level);
    hintButton.onclick = () => showHint(level);
    if (focusHeading) find("level-title").focus();
  }

  function startLevel(index) {
    levelIndex = index;
    document.body.classList.add("is-playing");
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    showWarning(saveProgress(getStorage, levelIndex));
    showLevel(true);
  }

  function finishBridge() {
    showWarning(clearProgress(getStorage));
    playArea.hidden = true;
    finale.hidden = false;
    find("quest-heading").focus();
  }

  find("start-game").addEventListener("click", () => startLevel(progress.level ?? 0));
  find("new-quest").addEventListener("click", () => {
    showWarning(clearProgress(getStorage));
    startLevel(0);
  });
  nextButton.addEventListener("click", () => {
    if (levelIndex === LEVELS.length - 1) finishBridge();
    else startLevel(levelIndex + 1);
  });
  find("play-again").addEventListener("click", () => startLevel(0));
  if (progress.level > 0) {
    find("start-game").textContent = `Continue level ${progress.level + 1}`;
    find("new-quest").hidden = false;
  }
  showWarning(progress.warning);
}

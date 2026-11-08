import { LEVELS, STEPS_PER_LEVEL, buildRound, equationText, spokenEquation, hintText } from "./number-trail-engine.js";
import { createLevelProgress } from "./level-progress.js";
import { celebrate, stopCelebration } from "./alphabet-celebration.js";

const { loadProgress, saveProgress, clearProgress } =
  createLevelProgress("kid-games.number-trail.progress", "Number Trail");
const getStorage = () => window.localStorage;
const find = (id) => document.getElementById(id);
const tutorial = find("tutorial");
const playArea = find("play-area");
const finale = find("quest-complete");
const feedback = find("feedback");
const hint = find("trail-hint");
const next = find("next-step");
const hintButton = find("show-hint");
const heading = find("puzzle-heading");
const answers = find("answer-stones");
const status = find("preference-status");
let levelIndex = 0;
let stepIndex = 0;
let round = [];
let solved = false;

function showWarning(warning) {
  if (!warning) return;
  status.classList.add("warning");
  status.textContent = warning;
}

function drawMap() {
  find("level-map").replaceChildren(...LEVELS.map((level, index) => {
    const item = document.createElement("li");
    item.textContent = index + 1;
    item.setAttribute("aria-label", `Level ${index + 1}: ${level.title}${index < levelIndex ? ", finished" : ""}`);
    item.className = index < levelIndex ? "done" : index === levelIndex ? "current" : "";
    if (index === levelIndex) item.setAttribute("aria-current", "step");
    return item;
  }));
}

function drawPath() {
  const crossed = stepIndex + (solved ? 1 : 0);
  find("progress").textContent = `${crossed} of ${STEPS_PER_LEVEL} stones crossed in this level.`;
  find("trail-path").replaceChildren(...Array.from({ length: STEPS_PER_LEVEL }, (_, index) => {
    const item = document.createElement("li");
    const done = index < crossed;
    const current = index === stepIndex;
    const bunny = document.createElement("span");
    bunny.textContent = "\u{1f430} ";
    bunny.setAttribute("aria-hidden", "true");
    bunny.className = "trail-bunny";
    if (current) item.append(bunny);
    const number = document.createElement("span");
    number.className = "trail-number";
    number.textContent = `${done ? "\u2713 " : ""}${index + 1}`;
    item.append(number);
    item.setAttribute("aria-label", `Stone ${index + 1}: ${done ? "crossed" : "not crossed yet"}`);
    item.className = [done && "crossed", current && "current"].filter(Boolean).join(" ");
    if (current) item.setAttribute("aria-current", "step");
    return item;
  }));
}

function showHint() {
  hint.hidden = false;
  hint.textContent = hintText(round[stepIndex]);
}

function chooseAnswer(value) {
  if (solved) return;
  const problem = round[stepIndex];
  if (value !== problem.answer) {
    feedback.classList.remove("success");
    feedback.textContent = `${value} doesn't fit yet. Try another stone!`;
    showHint();
    return;
  }
  solved = true;
  feedback.classList.add("success");
  feedback.textContent = `That's it! ${equationText(problem, true)}. You crossed a stone!`;
  for (const button of answers.querySelectorAll("button")) {
    button.disabled = true;
    if (Number(button.value) === value) {
      button.classList.add("correct");
      button.setAttribute("aria-label", `Stepping stone ${value}, correct`);
    }
  }
  hint.hidden = true;
  hintButton.hidden = true;
  drawPath();
  next.textContent = stepIndex < STEPS_PER_LEVEL - 1
    ? "Next step" : levelIndex < LEVELS.length - 1 ? "Next level" : "Finish trail";
  next.hidden = false;
  // Save the next level as soon as it is earned, even if the player leaves here.
  if (stepIndex === STEPS_PER_LEVEL - 1 && levelIndex < LEVELS.length - 1) {
    showWarning(saveProgress(getStorage, levelIndex + 1));
  }
  next.focus();
}

function showPuzzle(focusHeading = true) {
  stopCelebration();
  solved = false;
  feedback.textContent = "";
  feedback.classList.remove("success");
  hint.textContent = "";
  hint.hidden = true;
  hintButton.hidden = false;
  next.hidden = true;
  const problem = round[stepIndex];
  heading.textContent = equationText(problem);
  heading.setAttribute("aria-label", spokenEquation(problem));
  answers.replaceChildren(...problem.choices.map((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button trail-stone";
    button.textContent = value;
    button.value = value;
    button.setAttribute("aria-label", `Stepping stone ${value}`);
    button.addEventListener("click", () => chooseAnswer(value));
    return button;
  }));
  drawPath();
  if (focusHeading) heading.focus();
}

function startLevel(index) {
  levelIndex = index;
  stepIndex = 0;
  round = buildRound(index);
  document.body.classList.add("is-playing");
  tutorial.hidden = true;
  finale.hidden = true;
  playArea.hidden = false;
  showWarning(saveProgress(getStorage, index));
  drawMap();
  find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
  const level = LEVELS[index];
  find("level-title").textContent = level.title;
  const skill = level.operations.length === 2 ? "Add or subtract"
    : level.operations[0] === "+" ? "Add" : "Subtract";
  find("level-instructions").textContent =
    `${skill} with numbers within ${level.max}. ${level.unit === 10 ? "Work in jumps of 10. " : ""}` +
    (level.missing ? "Find the missing starting number or the missing amount." : "Find the total or the amount left.");
  showPuzzle(false);
  find("level-title").focus();
}

function restart() {
  showWarning(clearProgress(getStorage));
  startLevel(0);
}

find("start-game").addEventListener("click", () => {
  const progress = loadProgress(getStorage, LEVELS.length);
  showWarning(progress.warning);
  startLevel(progress.level ?? 0);
});
find("new-quest").addEventListener("click", restart);
find("play-again").addEventListener("click", restart);
hintButton.addEventListener("click", showHint);
next.addEventListener("click", () => {
  if (!solved) return;
  if (stepIndex < STEPS_PER_LEVEL - 1) {
    stepIndex += 1;
    showPuzzle();
  } else if (levelIndex < LEVELS.length - 1) {
    startLevel(levelIndex + 1);
    celebrate();
  } else {
    showWarning(clearProgress(getStorage));
    playArea.hidden = true;
    finale.hidden = false;
    find("quest-heading").focus();
    celebrate();
  }
});

const saved = loadProgress(getStorage, LEVELS.length);
showWarning(saved.warning);
if (saved.level !== undefined) {
  find("start-game").textContent = `Continue level ${saved.level + 1}`;
  find("new-quest").hidden = false;
}

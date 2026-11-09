import { LEVELS, buildJourney, stepEquation, stepStory, stepHint } from "./acorn-adventure-engine.js";
import { createLevelProgress } from "./level-progress.js";
import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { isQuizMode } from "./quiz-engine.js";

if (!isQuizMode(window.location.search)) {

const { loadProgress, saveProgress, clearProgress } =
  createLevelProgress("kid-games.acorn-adventure.progress", "Acorn Adventure");
const storage = () => window.localStorage;
const find = (id) => document.getElementById(id);
let levelIndex = 0;
let stepIndex = 0;
let journey;
let solved = false;

function warn(message) {
  if (!message) return;
  find("preference-status").classList.add("warning");
  find("preference-status").textContent = message;
}

function drawJourney() {
  const completed = stepIndex + (solved ? 1 : 0);
  const total = completed ? journey.steps[completed - 1].total : journey.start;
  find("basket-total").textContent = `Your basket: ${total} ${total === 1 ? "nut" : "nuts"}`;
  find("progress").textContent = `${completed} of ${journey.steps.length} stops completed.`;
  const expression = find("expression");
  expression.replaceChildren(document.createTextNode(`${journey.start} `));
  journey.steps.forEach((step, index) => {
    const term = document.createElement("span");
    term.textContent = `${step.operation === "+" ? "+" : "\u2212"} ${step.amount}`;
    if (index < completed) {
      term.className = "acorn-term done";
      term.setAttribute("aria-label", `${step.operation === "+" ? "plus" : "minus"} ${step.amount}, completed`);
    } else if (index === stepIndex) {
      term.className = "acorn-term current";
      term.setAttribute("aria-current", "step");
      term.setAttribute("aria-label", `${step.operation === "+" ? "plus" : "minus"} ${step.amount}, current step`);
    } else term.className = "acorn-term";
    expression.append(term, " ");
  });
  expression.append(`= ${completed === journey.steps.length ? journey.total : "?"}`);
  find("journey-log").replaceChildren(...journey.steps.slice(0, completed).map((step) => {
    const item = document.createElement("li");
    item.textContent = `${stepEquation(step)}. Carry ${step.total} forward.`;
    return item;
  }));
}

function showHint() {
  find("hint").hidden = false;
  find("hint").textContent = stepHint(journey.steps[stepIndex]);
}

function answer(value) {
  if (solved) return;
  const step = journey.steps[stepIndex];
  if (value !== step.total) {
    find("feedback").textContent = `${value} isn't the new total yet. Try again; your earlier steps are safe.`;
    showHint();
    return;
  }
  solved = true;
  find("feedback").classList.add("success");
  find("feedback").textContent = `That's it! ${stepEquation(step)}. Your basket now holds ${step.total}.`;
  find("step-equation").textContent = stepEquation(step);
  find("step-equation").setAttribute("aria-label", `${step.before} ${step.operation === "+" ? "plus" : "minus"} ${step.amount} equals ${step.total}`);
  for (const button of find("answers").querySelectorAll("button")) {
    button.disabled = true;
    if (Number(button.value) === value) button.classList.add("correct");
  }
  find("hint").hidden = true;
  find("show-hint").hidden = true;
  drawJourney();
  const last = stepIndex === journey.steps.length - 1;
  const next = find("next-step");
  next.textContent = last ? (levelIndex === LEVELS.length - 1 ? "Finish adventure" : "Next level") : "Next stop";
  next.hidden = false;
  if (last && levelIndex < LEVELS.length - 1) warn(saveProgress(storage, levelIndex + 1));
  next.focus();
}

function showStep(focus = true) {
  stopCelebration();
  solved = false;
  find("feedback").textContent = "";
  find("feedback").classList.remove("success");
  find("hint").hidden = true;
  find("hint").textContent = "";
  find("show-hint").hidden = false;
  find("next-step").hidden = true;
  const step = journey.steps[stepIndex];
  find("step-heading").textContent = `Stop ${stepIndex + 1}: ${step.operation === "+" ? "Gather more" : "Share with a friend"}`;
  find("step-story").textContent = stepStory(step);
  const equation = find("step-equation");
  equation.textContent = `${step.before} ${step.operation === "+" ? "+" : "\u2212"} ${step.amount} = ?`;
  equation.setAttribute("aria-label", `${step.before} ${step.operation === "+" ? "plus" : "minus"} ${step.amount} equals what number?`);
  find("answers").replaceChildren(...step.choices.map((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button trail-stone";
    button.value = value;
    button.textContent = value;
    button.setAttribute("aria-label", `${value} nuts`);
    button.addEventListener("click", () => answer(value));
    return button;
  }));
  drawJourney();
  if (focus) find("step-heading").focus();
}

function startLevel(index) {
  levelIndex = index;
  stepIndex = 0;
  journey = buildJourney(index);
  document.body.classList.add("is-playing");
  find("tutorial").hidden = true;
  find("quest-complete").hidden = true;
  find("play-area").hidden = false;
  warn(saveProgress(storage, index));
  find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
  find("level-title").textContent = LEVELS[index].title;
  find("level-map").replaceChildren(...LEVELS.map((level, position) => {
    const item = document.createElement("li");
    item.textContent = position + 1;
    item.setAttribute("aria-label", `Level ${position + 1}: ${level.title}${position < index ? ", finished" : ""}`);
    item.className = position < index ? "done" : position === index ? "current" : "";
    if (position === index) item.setAttribute("aria-current", "step");
    return item;
  }));
  showStep(false);
  find("level-title").focus();
}

function restart() {
  warn(clearProgress(storage));
  startLevel(0);
}

find("start-game").addEventListener("click", () => {
  const saved = loadProgress(storage, LEVELS.length);
  warn(saved.warning);
  startLevel(saved.level ?? 0);
});
find("new-quest").addEventListener("click", restart);
find("play-again").addEventListener("click", restart);
find("show-hint").addEventListener("click", showHint);
find("next-step").addEventListener("click", () => {
  if (!solved) return;
  if (stepIndex < journey.steps.length - 1) {
    stepIndex += 1;
    showStep();
  } else if (levelIndex < LEVELS.length - 1) {
    startLevel(levelIndex + 1);
    celebrate(GAME_CELEBRATIONS["acorn-adventure"]);
  } else {
    warn(clearProgress(storage));
    find("play-area").hidden = true;
    find("quest-complete").hidden = false;
    find("quest-heading").focus();
    celebrate(GAME_CELEBRATIONS["acorn-adventure"]);
  }
});

const saved = loadProgress(storage, LEVELS.length);
warn(saved.warning);
if (saved.level !== undefined) {
  find("start-game").textContent = `Continue level ${saved.level + 1}`;
  find("new-quest").hidden = false;
}
}

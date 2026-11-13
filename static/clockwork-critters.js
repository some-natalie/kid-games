import { advanceTime, buildRound, clockDescription, formatTime, hintText, LEVELS, STEPS_PER_LEVEL, timeChoices } from "./clockwork-critters-engine.js";
import { createClockFace } from "./clockwork-critters-clock.js";
import { createLevelProgress } from "./level-progress.js";
import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { isQuizMode } from "./quiz-engine.js";

if (!isQuizMode(window.location.search)) {
  const { loadProgress, saveProgress, clearProgress } =
    createLevelProgress("kid-games.clockwork-critters.progress", "Clockwork Critters");
  const storage = () => window.localStorage;
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const status = find("preference-status");
  const feedback = find("feedback");
  const hint = find("clock-hint");
  const prompt = find("clock-prompt");
  const clockDisplay = find("clock-display");
  const clockText = find("clock-description");
  const controls = find("clock-controls");
  const choices = find("clock-choices");
  const next = find("next-step");
  const check = find("check-clock");
  let levelIndex = 0;
  let stepIndex = 0;
  let round = [];
  let mode = "set";
  let clockTime = 720;
  let solved = false;

  function showWarning(message) {
    if (!message) return;
    status.classList.add("warning");
    status.textContent = message;
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

  function updateClock(time) {
    clockDisplay.replaceChildren(createClockFace(time));
    clockText.textContent = clockDescription(time);
  }

  function updateModeButtons() {
    find("mode-set").setAttribute("aria-pressed", String(mode === "set"));
    find("mode-read").setAttribute("aria-pressed", String(mode === "read"));
  }

  function renderControls() {
    controls.replaceChildren();
    choices.replaceChildren();
    const problem = round[stepIndex];
    if (mode === "set") {
      controls.hidden = false;
      choices.hidden = true;
      for (const [label, amount, unit] of [
        ["Move hour hand back one hour", -60, "hour"],
        ["Move hour hand forward one hour", 60, "hour"],
        [`Move minute hand back ${problem.interval} minutes`, -problem.interval, "minute"],
        [`Move minute hand forward ${problem.interval} minutes`, problem.interval, "minute"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button";
        button.textContent = label;
        button.setAttribute("aria-label", label);
        button.dataset.hand = unit;
        button.addEventListener("click", () => {
          if (solved) return;
          clockTime = advanceTime(clockTime, amount);
          updateClock(clockTime);
          feedback.textContent = "";
          feedback.classList.remove("success");
          hint.hidden = true;
        });
        controls.append(button);
      }
    } else {
      controls.hidden = true;
      choices.hidden = false;
      for (const time of timeChoices(problem.time, problem.interval)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary-button";
        button.textContent = formatTime(time);
        button.setAttribute("aria-label", `${formatTime(time)}`);
        button.addEventListener("click", () => answer(time));
        choices.append(button);
      }
    }
  }

  function showHint() {
    hint.hidden = false;
    hint.textContent = hintText(round[stepIndex].time, round[stepIndex].interval, mode);
  }

  function answer(value) {
    if (solved) return;
    const problem = round[stepIndex];
    if (value !== problem.time) {
      feedback.classList.remove("success");
      feedback.textContent = "Not quite. Take another look and try again.";
      showHint();
      return;
    }
    solved = true;
    feedback.classList.add("success");
    const { message } = celebrate(GAME_CELEBRATIONS["clockwork-critters"]);
    feedback.textContent = `${message} That's ${formatTime(problem.time)}! ${clockDescription(problem.time)}`;
    hint.hidden = true;
    for (const button of controls.querySelectorAll("button")) button.disabled = true;
    for (const button of choices.querySelectorAll("button")) button.disabled = true;
    find("mode-set").disabled = true;
    find("mode-read").disabled = true;
    check.hidden = true;
    next.textContent = stepIndex < STEPS_PER_LEVEL - 1
      ? "Next activity" : levelIndex < LEVELS.length - 1 ? "Next level" : "Finish schedule";
    next.hidden = false;
    if (stepIndex === STEPS_PER_LEVEL - 1 && levelIndex < LEVELS.length - 1) {
      showWarning(saveProgress(storage, levelIndex + 1));
    }
    next.focus();
  }

  function showPuzzle(focus = true) {
    stopCelebration();
    solved = false;
    clockTime = 720;
    feedback.textContent = "";
    feedback.classList.remove("success");
    hint.textContent = "";
    hint.hidden = true;
    next.hidden = true;
    find("mode-set").disabled = false;
    find("mode-read").disabled = false;
    check.hidden = mode !== "set";
    const problem = round[stepIndex];
    prompt.textContent = mode === "set"
      ? `Set the clock to ${formatTime(problem.time)} for the critters' schedule.`
      : `What time is shown for this part of the critters' schedule?`;
    updateClock(mode === "set" ? clockTime : problem.time);
    renderControls();
    find("progress").textContent = `Activity ${stepIndex + 1} of ${STEPS_PER_LEVEL} in this level.`;
    updateModeButtons();
    if (focus) prompt.focus();
  }

  function startLevel(index) {
    levelIndex = index;
    stepIndex = 0;
    round = buildRound(index);
    document.body.classList.add("is-playing");
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    showWarning(saveProgress(storage, index));
    drawMap();
    find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
    find("level-title").textContent = LEVELS[index].title;
    find("level-instructions").textContent =
      `Practice ${LEVELS[index].description}. Each number the minute hand points to stands for 5 minutes, and the hour hand moves between numbers as minutes pass.`;
    showPuzzle(false);
    find("level-title").focus();
  }

  function restart() {
    stopCelebration();
    showWarning(clearProgress(storage));
    startLevel(0);
  }

  function selectMode(nextMode) {
    if (mode === nextMode || solved) return;
    mode = nextMode;
    showPuzzle(false);
    find(mode === "set" ? "mode-set" : "mode-read").focus();
  }

  find("clock-example").append(createClockFace(210));
  find("start-game").addEventListener("click", () => {
    const progress = loadProgress(storage, LEVELS.length);
    showWarning(progress.warning);
    startLevel(progress.level ?? 0);
  });
  find("new-quest").addEventListener("click", restart);
  find("play-again").addEventListener("click", restart);
  find("mode-set").addEventListener("click", () => selectMode("set"));
  find("mode-read").addEventListener("click", () => selectMode("read"));
  find("show-hint").addEventListener("click", showHint);
  check.addEventListener("click", () => answer(clockTime));
  next.addEventListener("click", () => {
    if (!solved) return;
    stopCelebration();
    if (stepIndex < STEPS_PER_LEVEL - 1) {
      stepIndex += 1;
      showPuzzle();
    } else if (levelIndex < LEVELS.length - 1) {
      startLevel(levelIndex + 1);
    } else {
      showWarning(clearProgress(storage));
      playArea.hidden = true;
      finale.hidden = false;
      find("quest-heading").focus();
      celebrate(GAME_CELEBRATIONS["clockwork-critters"]);
    }
  });

  const saved = loadProgress(storage, LEVELS.length);
  showWarning(saved.warning);
  if (saved.level !== undefined) {
    find("start-game").textContent = `Continue level ${saved.level + 1}`;
    find("new-quest").hidden = false;
  }
}

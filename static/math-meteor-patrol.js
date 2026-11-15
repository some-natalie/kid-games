import {
  MODES, OPERATIONS, buildProblem, equationText, maxForWave, strategyText, travelDuration,
} from "./math-meteor-patrol-engine.js";
import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { isQuizMode } from "./quiz-engine.js";

if (!isQuizMode(window.location.search)) {
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const feedback = find("feedback");
  const input = find("answer");
  const form = find("answer-form");
  const modeSelect = find("mode");
  const operationSelect = find("operation");
  const preferenceStatus = find("preference-status");
  const STORAGE_KEY = "kid-games.math-meteor-patrol.preferences";
  const BREATHING_MS = 1400;
  const MISS_BREAK_MS = 2400;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rewards = GAME_CELEBRATIONS["math-meteor-patrol"];
  const sparkleReward = { ...rewards, effects: rewards.effects.filter(({ id }) => id === "meteor-sparkles") };
  let mode = "practice";
  let operation = "addition";
  let wave = 0;
  let problem;
  let remaining = 0;
  let phase = "moving";
  let phaseRemaining = 0;
  let lastFrame;
  let frameId;
  let manuallyPaused = false;
  let solved = false;
  let correctCount = 0;
  let missedCount = 0;

  function showStorageWarning(message) {
    preferenceStatus.classList.toggle("warning", Boolean(message));
    preferenceStatus.textContent = message || "Your patrol choices are saved only in this browser.";
  }

  function readPreferences() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (Object.hasOwn(MODES, saved?.mode)) mode = saved.mode;
      if (Object.hasOwn(OPERATIONS, saved?.operation)) operation = saved.operation;
    } catch {
      showStorageWarning("This browser couldn't read your saved choices. You can still play.");
    }
    modeSelect.value = mode;
    operationSelect.value = operation;
  }

  function savePreferences() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode, operation }));
      showStorageWarning("");
    } catch {
      showStorageWarning("You can keep playing, but this browser couldn't save your choices.");
    }
  }

  function updateModeDescription() {
    const text = mode === "practice"
      ? "Untimed practice has no countdown. Correct mistakes and continue when you are ready."
      : mode === "gentle"
        ? "Gentle patrol starts with 18 seconds per meteor. Correct answers pause the next threat briefly."
        : "Challenge starts with 12 seconds per meteor. The countdown eases faster a little at a time.";
    find("mode-description").textContent = text;
  }

  function updateMotionPreference() {
    playArea.dataset.reducedMotion = String(reducedMotion.matches);
    updateTimer();
  }

  function updatePauseControls() {
    const paused = manuallyPaused || document.hidden;
    find("pause-game").hidden = paused;
    find("resume-game").hidden = !paused || document.hidden;
    find("suspension-note").hidden = !document.hidden;
  }

  function updateTimer() {
    if (playArea.hidden || wave === 0) return;
    const lane = find("meteor-lane");
    const card = find("meteor-card");
    const fraction = mode === "practice" ? 1 : Math.max(0, remaining / travelDuration(mode, wave));
    const start = card.offsetHeight / 2 + 8;
    const end = lane.clientHeight - find("meteor-shield").offsetHeight - card.offsetHeight / 2 - 8;
    card.style.top = `${mode === "practice" || reducedMotion.matches
      ? (start + end) / 2 : start + (end - start) * (1 - fraction)}px`;
    if (mode === "practice") return;
    find("time-left").value = fraction;
    find("countdown").textContent = `${Math.ceil(Math.max(0, remaining) / 1000)} seconds remain`;
  }

  function setAnswerDisabled(disabled) {
    input.disabled = disabled;
    form.querySelector('button[type="submit"]').disabled = disabled;
    find("number-pad").querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
  }

  function showMiss() {
    find("meteor-lane").dataset.state = "shield";
    phase = "missed";
    phaseRemaining = MISS_BREAK_MS;
    missedCount += 1;
    solved = true;
    setAnswerDisabled(true);
    const equation = equationText(problem);
    feedback.textContent = `The meteor reached the shield; that's okay. The correct equation is ${equation}. ${strategyText(problem)} The next meteor will arrive shortly.`;
    updateTimer();
  }

  function renderProblem() {
    stopCelebration();
    wave += 1;
    problem = buildProblem(operation, maxForWave(wave));
    phase = "moving";
    phaseRemaining = 0;
    solved = false;
    remaining = travelDuration(mode, wave);
    find("wave-label").textContent = `Meteor ${wave}`;
    find("target-label").textContent = `Target: ${OPERATIONS[operation].label}, within ${problem.max}`;
    find("equation").textContent = `${problem.left} ${OPERATIONS[operation].symbol} ${problem.right} = ?`;
    find("equation").setAttribute("aria-label", `${problem.left} ${operation === "addition" ? "plus" : operation === "subtraction" ? "minus" : "times"} ${problem.right} equals what?`);
    find("meteor-card").hidden = false;
    find("meteor-lane").dataset.state = "falling";
    find("meteor-lane").setAttribute("aria-label", mode === "practice" || reducedMotion.matches
      ? "One active meteor waiting above the shield" : "One active meteor falling toward the shield");
    input.value = "";
    setAnswerDisabled(false);
    feedback.textContent = "";
    find("next-meteor").hidden = true;
    find("timer-panel").hidden = mode === "practice";
    updateTimer();
    if (mode !== "practice") {
      startFrameLoop();
    }
    input.focus();
  }

  function startFrameLoop() {
    if (mode === "practice" || frameId !== undefined || manuallyPaused || document.hidden) return;
    lastFrame = undefined;
    frameId = window.requestAnimationFrame(tick);
  }

  function tick(timestamp) {
    frameId = undefined;
    if (document.hidden) {
      lastFrame = undefined;
      return;
    }
    if (manuallyPaused || mode === "practice" || playArea.hidden) return;
    const delta = lastFrame === undefined ? 0 : timestamp - lastFrame;
    lastFrame = timestamp;
    if (phase === "moving") {
      remaining -= delta;
      updateTimer();
      if (remaining <= 0) showMiss();
    } else {
      phaseRemaining -= delta;
      if (phaseRemaining <= 0) {
        renderProblem();
        return;
      }
    }
    frameId = window.requestAnimationFrame(tick);
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (solved || phase !== "moving") return;
    if (!/^\d{1,2}$/.test(input.value)) {
      feedback.textContent = "Enter a whole number from 0 to 20.";
      input.focus();
      return;
    }
    if (Number(input.value) !== problem.answer) {
      feedback.textContent = `That answer doesn't fit yet. ${strategyText(problem)} You can change it and try again.`;
      input.select();
      return;
    }
    solved = true;
    correctCount += 1;
    setAnswerDisabled(true);
    find("meteor-lane").setAttribute("aria-label", "The meteor burst into sparkles. The shield is safe.");
    const { message } = celebrate(sparkleReward, find("meteor-card"));
    find("meteor-card").hidden = true;
    find("meteor-lane").dataset.state = "sparkles";
    feedback.textContent = `${message} Correct! ${equationText(problem)} The meteor burst into sparkles. The shield is safe.`;
    if (mode === "practice") {
      find("next-meteor").hidden = false;
      find("next-meteor").focus();
    } else {
      phase = "breathing";
      phaseRemaining = BREATHING_MS;
      feedback.textContent += " Take a short breather before the next meteor.";
    }
  }

  function finishPatrol() {
    if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    frameId = undefined;
    stopCelebration();
    playArea.hidden = true;
    finale.hidden = false;
    manuallyPaused = false;
    updatePauseControls();
    find("final-score").textContent = `You guided ${correctCount} meteor${correctCount === 1 ? "" : "s"} away and met ${missedCount} meteor${missedCount === 1 ? "" : "s"} at the shield.`;
    celebrate(GAME_CELEBRATIONS["math-meteor-patrol"]);
    find("quest-heading").focus();
  }

  function startPatrol() {
    mode = modeSelect.value;
    operation = operationSelect.value;
    savePreferences();
    wave = 0;
    correctCount = 0;
    missedCount = 0;
    manuallyPaused = false;
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    document.body.classList.add("is-playing");
    updatePauseControls();
    updateMotionPreference();
    renderProblem();
  }

  function returnToSetup() {
    if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    frameId = undefined;
    manuallyPaused = false;
    stopCelebration();
    playArea.hidden = true;
    finale.hidden = true;
    tutorial.hidden = false;
    document.body.classList.remove("is-playing");
    updateModeDescription();
  }

  find("number-pad").replaceChildren(...[
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "Delete",
  ].map((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = label;
    button.setAttribute("aria-label", label === "Delete" ? "Delete last digit" : label);
    button.addEventListener("click", () => {
      if (label === "Clear") input.value = "";
      else if (label === "Delete") input.value = input.value.slice(0, -1);
      else if (input.value.length < 2) input.value += label;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    return button;
  }));
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 2);
    if (phase === "moving" && !solved) feedback.textContent = "";
  });
  form.addEventListener("submit", submitAnswer);
  find("start-game").addEventListener("click", startPatrol);
  find("pause-game").addEventListener("click", () => {
    manuallyPaused = true;
    if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    frameId = undefined;
    updatePauseControls();
    feedback.textContent = "Patrol paused. The meteor and countdown are waiting.";
  });
  find("resume-game").addEventListener("click", () => {
    manuallyPaused = false;
    lastFrame = undefined;
    updatePauseControls();
    feedback.textContent = "Patrol resumed.";
    startFrameLoop();
  });
  find("end-game").addEventListener("click", finishPatrol);
  find("next-meteor").addEventListener("click", renderProblem);
  find("play-again").addEventListener("click", returnToSetup);
  modeSelect.addEventListener("change", () => {
    mode = modeSelect.value;
    updateModeDescription();
    savePreferences();
  });
  operationSelect.addEventListener("change", () => {
    operation = operationSelect.value;
    savePreferences();
  });
  document.addEventListener("visibilitychange", () => {
    updatePauseControls();
    if (document.hidden) {
      lastFrame = undefined;
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      frameId = undefined;
    } else if (!manuallyPaused) {
      lastFrame = undefined;
      startFrameLoop();
    }
  });
  reducedMotion.addEventListener("change", updateMotionPreference);
  window.addEventListener("resize", updateTimer);
  readPreferences();
  updateModeDescription();
  updateMotionPreference();
}

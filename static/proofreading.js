import { celebrate, DEFAULT_CELEBRATIONS, readCelebrations, stopCelebration } from "./alphabet-celebration.js";
import { buildRound, describeFix, gradeRound, MISTAKE_TYPES, tokenKey } from "./proofreading-engine.js";
import { CELEBRATION_MESSAGES, LEVELS } from "./proofreading-levels.js";
import { clearProgress, loadProgress, saveProgress } from "./proofreading-progress.js";

(() => {
  const tutorial = document.querySelector("#tutorial");
  const playArea = document.querySelector("#play-area");
  const questComplete = document.querySelector("#quest-complete");
  const proofText = document.querySelector("#proof-text");
  const progress = document.querySelector("#progress");
  const feedback = document.querySelector("#feedback");
  const fixes = document.querySelector("#fixes");
  const fixList = document.querySelector("#fix-list");
  const checkButton = document.querySelector("#check-marks");
  const clearButton = document.querySelector("#clear-marks");
  const nextButton = document.querySelector("#next-level");
  const startButton = document.querySelector("#start-game");
  const newQuestButton = document.querySelector("#new-quest");
  const playAgainButton = document.querySelector("#play-again");
  const levelMap = document.querySelector("#level-map");
  const preferenceStatus = document.querySelector("#preference-status");
  const getStorage = () => window.localStorage;
  const savedMessage = "Your level is saved only in this browser.";
  const punctuationNames = { ",": "comma", ".": "period", "!": "exclamation mark", "?": "question mark" };
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  let celebrations = { ...DEFAULT_CELEBRATIONS, messages: CELEBRATION_MESSAGES };
  let levelIndex = 0;
  let round;
  let marked = new Set();
  let results = null;
  let notes = [];
  let completed = false;
  let buttons = [];

  function showStatus(warning) {
    preferenceStatus.textContent = warning || savedMessage;
    preferenceStatus.classList.toggle("warning", Boolean(warning));
  }

  function persist(level) {
    const warning = saveProgress(getStorage, level);
    if (warning) showStatus(warning);
  }

  function updateStart() {
    const { level, warning } = loadProgress(getStorage, LEVELS.length);
    showStatus(warning);
    if (level > 0) {
      startButton.textContent = `Keep playing level ${level + 1}`;
      newQuestButton.hidden = false;
    } else {
      startButton.textContent = "Let’s play!";
      newQuestButton.hidden = true;
    }
  }

  function renderLevelMap() {
    levelMap.replaceChildren(...LEVELS.map((level, index) => {
      const step = document.createElement("li");
      step.textContent = String(index + 1);
      step.className = index < levelIndex || (index === levelIndex && completed) ? "done" :
        index === levelIndex ? "current" : "";
      if (index === levelIndex) step.setAttribute("aria-current", "step");
      return step;
    }));
    levelMap.setAttribute("aria-label", `Case map: level ${levelIndex + 1} of ${LEVELS.length}`);
  }

  function setPlaying(playing) {
    const wasPlaying = document.body.classList.contains("is-playing");
    document.body.classList.toggle("is-playing", playing);
    if (playing && !wasPlaying) document.querySelector(".proofreading-game").scrollIntoView({ block: "start" });
  }

  function labelFor(token) {
    if (token.kind === "mistake" && token.text.trim() === "") return "wide space between words";
    const base = punctuationNames[token.text] ?? token.text;
    return token.parts?.some((part) => part.mirrored) ? `${base}, mirrored` : base;
  }

  function buildToken(token, sentenceIndex, tokenIndex) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "proof-token";
    button.dataset.token = tokenKey(sentenceIndex, tokenIndex);
    button.dataset.kind = token.kind === "word" || token.kind === "mistake" && /\w/.test(token.text) ? "word" : "mark";
    button.setAttribute("aria-pressed", "false");
    button.tabIndex = -1;
    if (token.kind === "mistake" && token.text.trim() === "") {
      button.classList.add("proof-gap");
      button.textContent = " ";
    } else if (token.parts) {
      for (const part of token.parts) {
        const span = document.createElement("span");
        span.textContent = part.text;
        if (part.mirrored) span.className = "mirrored";
        button.append(span);
      }
    } else {
      button.textContent = token.text;
    }
    return button;
  }

  function renderText() {
    proofText.replaceChildren();
    notes = [];
    round.sentences.forEach((sentence, sentenceIndex) => {
      const wrapper = document.createElement("span");
      wrapper.className = "proof-sentence";
      let chunk;
      sentence.tokens.forEach((token, tokenIndex) => {
        if (token.kind === "space") {
          chunk = undefined;
          wrapper.append(document.createTextNode(token.text));
          return;
        }
        if (!chunk) {
          chunk = document.createElement("span");
          chunk.className = "proof-chunk";
          wrapper.append(chunk);
        }
        chunk.append(buildToken(token, sentenceIndex, tokenIndex));
      });
      const note = document.createElement("span");
      note.className = "sentence-note";
      note.hidden = true;
      wrapper.append(note);
      notes.push(note);
      proofText.append(wrapper, document.createTextNode(" "));
    });
    buttons = [...proofText.querySelectorAll(".proof-token")];
    buttons[0].tabIndex = 0;
  }

  function paint() {
    const tokenFor = (button) => {
      const [sentenceIndex, tokenIndex] = button.dataset.token.split(".").map(Number);
      return round.sentences[sentenceIndex].tokens[tokenIndex];
    };
    for (const button of buttons) {
      const key = button.dataset.token;
      const isMarked = marked.has(key);
      const result = results?.get(key);
      button.setAttribute("aria-pressed", String(isMarked));
      button.disabled = completed;
      if (result) button.dataset.result = result;
      else delete button.dataset.result;
      const status = result === "found" ? ", a mistake, correct" : result === "false" ? ", not a mistake" :
        isMarked ? ", marked" : "";
      button.setAttribute("aria-label", labelFor(tokenFor(button)) + status);
    }
    progress.textContent = `${plural(round.total, "mistake")} to find · ${marked.size} marked`;
    checkButton.disabled = completed;
    clearButton.disabled = completed || marked.size === 0;
    renderLevelMap();
  }

  function clearResults() {
    results = null;
    feedback.textContent = "";
    feedback.classList.remove("success");
    for (const note of notes) note.hidden = true;
  }

  function startLevel(index) {
    stopCelebration();
    levelIndex = index;
    round = buildRound(LEVELS[index]);
    marked = new Set();
    completed = false;
    setPlaying(true);
    tutorial.hidden = true;
    questComplete.hidden = true;
    playArea.hidden = false;
    nextButton.hidden = true;
    fixes.hidden = true;
    document.querySelector("#level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
    document.querySelector("#level-title").textContent = LEVELS[index].title;
    document.querySelector("#level-hint").textContent = LEVELS[index].hint;
    renderText();
    clearResults();
    paint();
    persist(index);
    document.querySelector("#level-title").focus();
  }

  function toggle(button) {
    if (completed) return;
    const key = button.dataset.token;
    if (marked.has(key)) marked.delete(key);
    else marked.add(key);
    clearResults();
    paint();
  }

  function focusToken(index) {
    const target = buttons[Math.max(0, Math.min(buttons.length - 1, index))];
    for (const button of buttons) button.tabIndex = button === target ? 0 : -1;
    target.focus();
  }

  function showFixes() {
    fixList.replaceChildren();
    for (const sentence of round.sentences) {
      for (const token of sentence.tokens.filter((item) => item.kind === "mistake")) {
        const item = document.createElement("li");
        const kind = document.createElement("strong");
        kind.textContent = `${MISTAKE_TYPES[token.type].label}: `;
        item.append(kind, `${describeFix(token)} ${MISTAKE_TYPES[token.type].tip}`);
        fixList.append(item);
      }
    }
    fixes.hidden = false;
  }

  function finishQuest() {
    const warning = clearProgress(getStorage);
    if (warning) showStatus(warning);
    playArea.hidden = true;
    questComplete.hidden = false;
    document.querySelector("#quest-heading").focus();
    celebrate(celebrations);
  }

  function checkMarks() {
    if (marked.size === 0) {
      feedback.classList.remove("success");
      feedback.textContent = "Tap the words, letters, or punctuation that look wrong first. Then choose Check.";
      return;
    }
    const grade = gradeRound(round, marked);
    completed = grade.complete;
    if (completed) {
      const { message } = celebrate(celebrations);
      feedback.textContent = `${message} You found all ${plural(grade.total, "mistake")}! 🎉`;
      feedback.classList.add("success");
      results = new Map(grade.found.map((key) => [key, "found"]));
      paint();
      showFixes();
      if (levelIndex === LEVELS.length - 1) {
        setTimeout(finishQuest, 4000);
        return;
      }
      persist(levelIndex + 1);
      nextButton.hidden = false;
      nextButton.focus();
      return;
    }
    results = new Map([
      ...grade.found.map((key) => [key, "found"]),
      ...grade.falseAlarms.map((key) => [key, "false"]),
    ]);
    const parts = [`Good looking! You found ${grade.found.length} of ${plural(grade.total, "mistake")}.`];
    if (grade.falseAlarms.length > 0) {
      parts.push(`${plural(grade.falseAlarms.length, "marked spot")} marked ✗ ${grade.falseAlarms.length === 1 ? "is" : "are"} already correct.`);
    }
    if (grade.missed > 0) parts.push(`${plural(grade.missed, "mistake")} still hiding.`);
    parts.push("Change your marks and check again!");
    feedback.classList.remove("success");
    feedback.textContent = parts.join(" ");
    grade.missedBySentence.forEach((count, index) => {
      notes[index].hidden = count === 0;
      notes[index].textContent = ` (${count} more here)`;
    });
    paint();
    checkButton.focus();
  }

  async function loadCelebrations() {
    try {
      const response = await fetch(new URL("./celebrations.json", import.meta.url));
      if (!response.ok) throw new Error(`Celebrations request failed (${response.status}).`);
      celebrations = { ...readCelebrations(await response.json()), messages: CELEBRATION_MESSAGES };
    } catch (error) {
      console.warn("Using built-in celebrations:", error);
    }
  }

  proofText.addEventListener("click", (event) => {
    const button = event.target.closest(".proof-token");
    if (button) {
      toggle(button);
      focusToken(buttons.indexOf(button));
    }
  });
  proofText.addEventListener("keydown", (event) => {
    const current = buttons.indexOf(event.target.closest(".proof-token"));
    const moves = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1,
      Home: 0, End: buttons.length - 1 };
    if (current === -1 || !(event.key in moves)) return;
    event.preventDefault();
    focusToken(moves[event.key]);
  });
  checkButton.addEventListener("click", checkMarks);
  clearButton.addEventListener("click", () => {
    marked = new Set();
    clearResults();
    paint();
  });
  nextButton.addEventListener("click", () => startLevel(levelIndex + 1));
  startButton.addEventListener("click", () => startLevel(loadProgress(getStorage, LEVELS.length).level ?? 0));
  const restart = () => {
    const warning = clearProgress(getStorage);
    if (warning) showStatus(warning);
    startLevel(0);
  };
  newQuestButton.addEventListener("click", restart);
  playAgainButton.addEventListener("click", restart);

  loadCelebrations();
  updateStart();
})();

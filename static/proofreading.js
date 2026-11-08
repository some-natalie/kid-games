import { celebrate, DEFAULT_CELEBRATIONS, readCelebrations, stopCelebration } from "./alphabet-celebration.js";
import { buildRound, correctionParts, describeFix, gradeRound, MISTAKE_TYPES, pickVariant, tokenKey } from "./proofreading-engine.js";
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
  const finishButton = document.querySelector("#finish-case");
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
  let corrected = new Set();
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
    if (button.dataset.kind === "mark" && token.text.trim()) button.classList.add("proof-punctuation");
    button.setAttribute("aria-pressed", "false");
    button.tabIndex = -1;
    fillToken(button, token);
    return button;
  }

  function fillToken(button, token, fixed = false) {
    button.replaceChildren();
    button.classList.toggle("proof-gap", !fixed && token.kind === "mistake" && token.text.trim() === "");
    button.classList.toggle("proof-fixed-gap", fixed && token.text.trim() === "" && token.right.trim() === "");
    button.classList.toggle("proof-removed", fixed && token.right === "");
    if (fixed) {
      if (token.right === "") {
        const removed = document.createElement("del");
        removed.textContent = token.text;
        button.append(removed);
      } else {
        const { before, changed, after, removed } = correctionParts(token);
        const change = document.createElement("strong");
        change.className = "proof-change";
        change.textContent = changed;
        button.append(before);
        if (removed) {
          const deletion = document.createElement("del");
          deletion.className = "proof-deletion";
          deletion.textContent = removed;
          button.append(deletion);
        }
        if (changed) button.append(change);
        button.append(after);
      }
    } else if (token.kind === "mistake" && token.text.trim() === "") {
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
        if (token.type === "space-after") chunk = undefined;
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
      const fixed = corrected.has(key);
      const token = tokenFor(button);
      const result = fixed ? "found" : results?.get(key);
      fillToken(button, token, fixed);
      button.setAttribute("aria-pressed", String(isMarked));
      button.disabled = completed || fixed;
      if (result) button.dataset.result = result;
      else delete button.dataset.result;
      const status = result === "false" ? ", not a mistake" :
        isMarked ? ", marked" : "";
      button.setAttribute("aria-label", fixed ? fixedLabel(token) : labelFor(token) + status);
    }
    progress.textContent = `${plural(round.total, "mistake")} to find · ${marked.size} marked · ${corrected.size} fixed`;
    checkButton.disabled = completed;
    clearButton.disabled = completed || marked.size === corrected.size;
    const available = buttons.filter((button) => !button.disabled && !button.hidden);
    if (!available.some((button) => button.tabIndex === 0)) {
      for (const button of buttons) button.tabIndex = button === available[0] ? 0 : -1;
    }
    renderLevelMap();
  }

  function fixedLabel(token) {
    if (token.right === "") return `${punctuationNames[token.text] || token.text}, removed, fixed`;
    const text = token.right.trim() || "single space";
    return `${punctuationNames[text] || text}, corrected. ${describeFix(token)}`;
  }

  function clearResults() {
    results = null;
    feedback.textContent = "";
    feedback.classList.remove("success");
    for (const note of notes) {
      note.hidden = true;
      note.textContent = "";
    }
  }

  function startLevel(index) {
    stopCelebration();
    levelIndex = index;
    round = buildRound({ sentences: pickVariant(LEVELS[index]) });
    marked = new Set();
    corrected = new Set();
    completed = false;
    setPlaying(true);
    tutorial.hidden = true;
    questComplete.hidden = true;
    playArea.hidden = false;
    nextButton.hidden = true;
    finishButton.hidden = true;
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
    if (completed || corrected.has(button.dataset.token)) return;
    const key = button.dataset.token;
    if (marked.has(key)) marked.delete(key);
    else marked.add(key);
    clearResults();
    paint();
  }

  function focusToken(index) {
    const available = buttons.filter((button) => !button.disabled && !button.hidden);
    const target = available[Math.max(0, Math.min(available.length - 1, index))];
    if (!target) return;
    for (const button of buttons) button.tabIndex = button === target ? 0 : -1;
    target.focus();
  }

  function showFixes() {
    fixList.replaceChildren();
    round.sentences.forEach((sentence, sentenceIndex) => {
      sentence.tokens.forEach((token, tokenIndex) => {
        if (!corrected.has(tokenKey(sentenceIndex, tokenIndex))) return;
        const item = document.createElement("li");
        const kind = document.createElement("strong");
        kind.textContent = `${MISTAKE_TYPES[token.type].label}: `;
        item.append(kind, `${describeFix(token)} ${MISTAKE_TYPES[token.type].tip}`);
        fixList.append(item);
      });
    });
    fixes.hidden = corrected.size === 0;
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
      feedback.textContent = "Tap the words, punctuation marks, or wide gaps that look wrong first. Then choose Check.";
      return;
    }
    const grade = gradeRound(round, marked);
    for (const key of grade.found) corrected.add(key);
    showFixes();
    completed = grade.complete;
    if (completed) {
      const { message } = celebrate(celebrations);
      feedback.textContent = `${message} You found all ${plural(grade.total, "mistake")}! 🎉`;
      feedback.classList.add("success");
      results = new Map(grade.found.map((key) => [key, "found"]));
      paint();
      if (levelIndex === LEVELS.length - 1) {
        finishButton.hidden = false;
        finishButton.focus();
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
    if (button && !button.disabled) {
      toggle(button);
      focusToken(buttons.filter((item) => !item.disabled && !item.hidden).indexOf(button));
    }
  });
  proofText.addEventListener("keydown", (event) => {
    const current = buttons.filter((button) => !button.disabled && !button.hidden)
      .indexOf(event.target.closest(".proof-token"));
    const moves = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1,
      Home: 0, End: buttons.filter((button) => !button.disabled && !button.hidden).length - 1 };
    if (current === -1 || !(event.key in moves)) return;
    event.preventDefault();
    focusToken(moves[event.key]);
  });
  checkButton.addEventListener("click", checkMarks);
  clearButton.addEventListener("click", () => {
    marked = new Set(corrected);
    clearResults();
    paint();
  });
  nextButton.addEventListener("click", () => startLevel(levelIndex + 1));
  finishButton.addEventListener("click", finishQuest);
  startButton.addEventListener("click", () => startLevel(loadProgress(getStorage, LEVELS.length).level ?? 0));
  const restart = () => {
    const warning = clearProgress(getStorage);
    if (warning) showStatus(warning);
    startLevel(0);
  };
  newQuestButton.addEventListener("click", restart);
  playAgainButton.addEventListener("click", restart);

  function setupExample() {
    const example = buildRound({ sentences: ["{my>My#capitalization} cat naps."] });
    const text = document.querySelector("#example-text");
    const status = document.querySelector("#example-status");
    const exampleMarks = new Set();
    const exampleButtons = [];
    example.sentences[0].tokens.forEach((token, index) => {
      if (token.kind === "space") {
        text.append(document.createTextNode(token.text));
        return;
      }
      const button = buildToken(token, 0, index);
      button.classList.replace("proof-token", "example-token");
      delete button.dataset.token;
      button.tabIndex = 0;
      button.setAttribute("aria-label", labelFor(token));
      button.addEventListener("click", () => {
        const key = tokenKey(0, index);
        if (exampleMarks.has(key)) exampleMarks.delete(key);
        else exampleMarks.add(key);
        button.setAttribute("aria-pressed", String(exampleMarks.has(key)));
        status.textContent = "Now choose Check example. Tap a marked item again to unmark it.";
      });
      exampleButtons.push({ button, token, key: tokenKey(0, index) });
      text.append(button);
    });
    document.querySelector("#check-example").addEventListener("click", () => {
      if (!gradeRound(example, exampleMarks).complete) {
        status.textContent = "Tap the whole word “my” only. It needs a capital M because it starts the sentence. Then check again.";
        return;
      }
      for (const { button, token, key } of exampleButtons) {
        button.disabled = true;
        if (exampleMarks.has(key)) {
          fillToken(button, token, true);
          button.dataset.result = "found";
          button.setAttribute("aria-label", fixedLabel(token));
        }
      }
      status.textContent = "You fixed it! The bold, underlined M shows the change from “my” to “My”. You are ready to play!";
      document.querySelector("#check-example").disabled = true;
      startButton.focus();
    });
  }

  setupExample();
  loadCelebrations();
  updateStart();
})();

import { playableThemes, QUEST_LEVELS, readWordBank, selectLevelWords, selectThemeWords, shuffled } from "./alphabet-word-lists.js";
import { DEFAULT_THEME, loadPreferences, savePreferences } from "./alphabet-preferences.js";
import { clearProgress, loadProgress, saveProgress } from "./alphabet-progress.js";
import { attachSorter, moveWord } from "./alphabet-sorter.js";
import { celebrate, stopCelebration } from "./alphabet-celebration.js";

(() => {
  const levels = QUEST_LEVELS;
  const tutorial = document.querySelector("#tutorial");
  const playArea = document.querySelector("#play-area");
  const questComplete = document.querySelector("#quest-complete");
  const answerList = document.querySelector("#answer-list");
  const progress = document.querySelector("#progress");
  const feedback = document.querySelector("#feedback");
  const undoButton = document.querySelector("#undo-word");
  const checkButton = document.querySelector("#check-order");
  const restartButton = document.querySelector("#restart-level");
  const nextButton = document.querySelector("#next-level");
  const startButton = document.querySelector("#start-game");
  const newQuestButton = document.querySelector("#new-quest");
  const playAgainButton = document.querySelector("#play-again");
  const loadStatus = document.querySelector("#load-status");
  const themeSelect = document.querySelector("#theme-select");
  const preferenceStatus = document.querySelector("#preference-status");
  const levelMap = document.querySelector("#level-map");
  const getStorage = () => window.localStorage;
  const savedMessage = "Your theme and level are saved only in this browser.";
  let themes = [];
  let selectedTheme = DEFAULT_THEME;
  let bank;
  let entries;
  let roundWords = [];
  let levelIndex = 0;
  let words = [];
  let history = [];
  let completed = false;
  const cancelDrag = attachSorter(answerList, (from, to) => {
    history.push([...words]);
    words = moveWord(words, from, to);
    feedback.textContent = "";
    render(to);
    persist();
    progress.textContent = `${words[to]} moved to position ${to + 1} of ${words.length}.`;
  });

  const themed = () => selectedTheme !== DEFAULT_THEME;
  const themeLabel = () => themes.find((theme) => theme.id === selectedTheme)?.label;

  function showStatus(warning) {
    preferenceStatus.textContent = warning || savedMessage;
  }

  function allowedWord(word, index) {
    const entry = entries.get(word.toLowerCase());
    if (!entry || entry.word !== word) return false;
    if (themed()) return entry.tags.has(selectedTheme) && !entry.tags.has("advanced");
    return entry.tags.has(levels[index].dinosaurs ? "dinosaurs" : "general");
  }

  function validProgress(saved) {
    if (!saved || typeof saved !== "object" || !Number.isInteger(saved.level) ||
        saved.level < 0 || saved.level >= levels.length) return false;
    if (saved.roundWords === undefined && saved.words === undefined) return true;
    const { roundWords: round, words: order } = saved;
    return Array.isArray(round) && Array.isArray(order) && round.length === levels[saved.level].count &&
      round.every((word) => typeof word === "string" && allowedWord(word, saved.level)) &&
      new Set(round).size === round.length && order.length === round.length &&
      [...order].sort().join("\n") === [...round].sort().join("\n");
  }

  function savedProgress() {
    const result = loadProgress(getStorage, selectedTheme, validProgress);
    if (result.warning) {
      showStatus(result.warning);
      clearProgress(getStorage, selectedTheme);
    }
    return result.progress;
  }

  function persist(nextLevel) {
    const state = nextLevel === undefined ? { level: levelIndex, roundWords, words } : { level: nextLevel };
    const warning = saveProgress(getStorage, selectedTheme, state);
    if (warning) showStatus(warning);
  }

  function updateStart() {
    const saved = bank && savedProgress();
    if (saved && saved.level > 0 || saved?.roundWords) {
      startButton.textContent = `Keep playing level ${saved.level + 1}`;
      newQuestButton.hidden = false;
    } else {
      startButton.textContent = "Let’s play!";
      newQuestButton.hidden = true;
    }
  }

  function renderLevelMap() {
    levelMap.replaceChildren(...levels.map((level, index) => {
      const step = document.createElement("li");
      step.textContent = String(index + 1);
      step.className = index < levelIndex || (index === levelIndex && completed) ? "done" :
        index === levelIndex ? "current" : "";
      if (index === levelIndex) step.setAttribute("aria-current", "step");
      return step;
    }));
    levelMap.setAttribute("aria-label", `Quest map: level ${levelIndex + 1} of ${levels.length}`);
  }

  function showPlay() {
    tutorial.hidden = true;
    questComplete.hidden = true;
    playArea.hidden = false;
  }

  function startLevel(index, { order, round } = {}) {
    cancelDrag();
    stopCelebration();
    const level = levels[index];
    levelIndex = index;
    if (round) roundWords = round;
    else roundWords = themed() ? selectThemeWords(bank, selectedTheme, level.count) : selectLevelWords(bank, level);
    history = [];
    completed = false;
    words = order ?? shuffled(roundWords);
    showPlay();
    document.querySelector("#level-count").textContent = `Level ${index + 1} of ${levels.length} · ${level.count} words`;
    document.querySelector("#level-title").textContent = themed() ? `${themeLabel()} adventure` : level.title;
    document.querySelector("#level-hint").textContent = themed() ?
      "Compare letters from the beginning until you find a difference. Shorter words come first when all their letters match." : level.hint;
    feedback.textContent = "";
    feedback.classList.remove("success");
    nextButton.hidden = true;
    restartButton.hidden = false;
    undoButton.hidden = false;
    render();
    persist();
    document.querySelector("#level-title").focus();
  }

  function resumeOrStart() {
    const saved = savedProgress();
    if (saved?.roundWords) startLevel(saved.level, { round: saved.roundWords, order: saved.words });
    else startLevel(saved?.level ?? 0);
  }

  function render(focusIndex) {
    answerList.replaceChildren();
    words.forEach((word, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "word-button";
      button.type = "button";
      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.textContent = "↕";
      handle.setAttribute("aria-hidden", "true");
      button.append(handle, document.createTextNode(word));
      button.setAttribute("aria-label", `${word}, position ${index + 1} of ${words.length}. Drag or use arrow keys to move.`);
      button.disabled = completed;
      item.append(button);
      answerList.append(item);
    });
    progress.textContent = `${words.length} words to put in ABC order`;
    undoButton.disabled = completed || history.length === 0;
    checkButton.disabled = completed;
    answerList.classList.toggle("solved", completed);
    renderLevelMap();
    if (focusIndex !== undefined) answerList.children[focusIndex].querySelector("button").focus();
  }

  function finishQuest() {
    const warning = clearProgress(getStorage, selectedTheme);
    if (warning) showStatus(warning);
    playArea.hidden = true;
    questComplete.hidden = false;
    document.querySelector("#quest-theme").textContent = themed() ?
      `You sorted every ${themeLabel()} level!` : "You sorted every level, all the way to the dinosaurs!";
    document.querySelector("#quest-heading").focus();
    celebrate();
  }

  function checkAnswers() {
    cancelDrag();
    const expected = [...roundWords].sort((first, second) =>
      first.localeCompare(second, "en", { sensitivity: "base" }),
    );
    const correct = words.filter((word, index) => word === expected[index]).length;
    completed = correct === words.length;
    if (completed) {
      const { message } = celebrate();
      const last = levelIndex === levels.length - 1;
      feedback.textContent = `${message} Every word is in the right place! 🎉`;
      feedback.classList.add("success");
      restartButton.hidden = true;
      undoButton.hidden = true;
      if (last) {
        render();
        setTimeout(finishQuest, 1200);
        return;
      }
      persist(levelIndex + 1);
      nextButton.hidden = false;
      render();
      nextButton.focus();
    } else {
      feedback.classList.remove("success");
      feedback.textContent = `Great try! ${correct} of ${words.length} words are in the right place. Keep dragging to fix the order, then check again!`;
      render();
      checkButton.focus();
    }
  }

  async function loadBank() {
    startButton.disabled = true;
    loadStatus.textContent = "Getting your words ready...";
    try {
      const response = await fetch(new URL("./words.json", import.meta.url));
      if (!response.ok) throw new Error(`Word bank request failed (${response.status}).`);
      bank = readWordBank(await response.json());
      entries = new Map(bank.map((entry) => [entry.word.toLowerCase(), entry]));
      levels.forEach((level) => selectLevelWords(bank, level));
      themes = playableThemes(bank);
      themeSelect.replaceChildren();
      const defaultOption = document.createElement("option");
      defaultOption.value = DEFAULT_THEME;
      defaultOption.textContent = "ABC adventure (all topics)";
      themeSelect.append(defaultOption);
      for (const theme of themes) {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.label;
        themeSelect.append(option);
      }
      const preferences = loadPreferences(getStorage, [DEFAULT_THEME, ...themes.map((theme) => theme.id)]);
      selectedTheme = preferences.theme;
      themeSelect.value = selectedTheme;
      showStatus(preferences.warning);
      themeSelect.disabled = false;
      startButton.disabled = false;
      loadStatus.textContent = "";
      updateStart();
      return true;
    } catch (error) {
      console.error("Unable to load Alphabetical Adventure:", error);
      bank = undefined;
      tutorial.hidden = false;
      playArea.hidden = true;
      loadStatus.textContent = "We couldn't load the words. Please try again.";
      themeSelect.disabled = true;
      startButton.disabled = false;
      startButton.textContent = "Try loading words again";
      return false;
    }
  }

  startButton.addEventListener("click", async () => {
    if (!bank && !await loadBank()) return;
    resumeOrStart();
  });
  newQuestButton.addEventListener("click", () => startLevel(0));
  themeSelect.addEventListener("change", () => {
    selectedTheme = themeSelect.value;
    showStatus(savePreferences(getStorage, selectedTheme));
    if (playArea.hidden && questComplete.hidden) updateStart();
    else resumeOrStart();
  });
  undoButton.addEventListener("click", () => {
    cancelDrag();
    words = history.pop();
    feedback.textContent = "";
    render();
    persist();
  });
  checkButton.addEventListener("click", checkAnswers);
  restartButton.addEventListener("click", () => startLevel(levelIndex, { round: roundWords }));
  nextButton.addEventListener("click", () => startLevel(levelIndex + 1));
  playAgainButton.addEventListener("click", () => startLevel(0));
  loadBank();
})();

import { playableThemes, readWordBank, selectThemeWords, selectWords, shuffled } from "./alphabet-word-lists.js";
import { DEFAULT_THEME, loadPreferences, savePreferences } from "./alphabet-preferences.js";
import { attachSorter, moveWord } from "./alphabet-sorter.js";

(() => {
  const levels = [
    {
      title: "First-letter friends",
      hint: "Look at the first letter of each word.",
      mode: "first-letter",
    },
    {
      title: "Look a little closer",
      hint: "Some words start with the same letter. Compare their second letters, too!",
      mode: "second-letter",
    },
    {
      title: "Dinosaur challenge",
      hint: "Dinosaur names can be long! Compare letters from the beginning until you find a difference.",
      mode: "dinosaurs",
    },
  ];

  const tutorial = document.querySelector("#tutorial");
  const playArea = document.querySelector("#play-area");
  const answerList = document.querySelector("#answer-list");
  const progress = document.querySelector("#progress");
  const feedback = document.querySelector("#feedback");
  const undoButton = document.querySelector("#undo-word");
  const checkButton = document.querySelector("#check-order");
  const restartButton = document.querySelector("#restart-level");
  const nextButton = document.querySelector("#next-level");
  const playAgainButton = document.querySelector("#play-again");
  const startButton = document.querySelector("#start-game");
  const loadStatus = document.querySelector("#load-status");
  const themeSelect = document.querySelector("#theme-select");
  const preferenceStatus = document.querySelector("#preference-status");
  const getStorage = () => window.localStorage;
  const savedMessage = "Your choice is saved only in this browser.";
  let themes = [];
  let selectedTheme = DEFAULT_THEME;
  let bank;
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
    progress.textContent = `${words[to]} moved to position ${to + 1} of ${words.length}.`;
  });

  function startLevel(index, newRound = true) {
    cancelDrag();
    const level = levels[index];
    const themed = selectedTheme !== DEFAULT_THEME;
    if (newRound) roundWords = themed ? selectThemeWords(bank, selectedTheme) : selectWords(bank, level.mode);
    levelIndex = index;
    history = [];
    completed = false;
    words = shuffled(roundWords);
    document.querySelector("#level-count").textContent = `${themed ? "Round" : "Level"} ${levelIndex + 1} of ${levels.length}`;
    document.querySelector("#level-title").textContent = themed ?
      `${themes.find((theme) => theme.id === selectedTheme).label} adventure` : level.title;
    document.querySelector("#level-hint").textContent = themed ?
      "Compare letters from the beginning until you find a difference. Shorter words come first when all their letters match." : level.hint;
    nextButton.textContent = themed ? "Next round" : "Next level";
    feedback.textContent = "";
    nextButton.hidden = true;
    playAgainButton.hidden = true;
    restartButton.hidden = false;
    restartButton.textContent = "Start over";
    undoButton.hidden = false;
    render();
    document.querySelector("#level-title").focus();
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
    restartButton.disabled = false;
    if (focusIndex !== undefined) answerList.children[focusIndex].querySelector("button").focus();
  }

  function checkAnswers() {
    cancelDrag();
    const expected = [...roundWords].sort((first, second) =>
      first.localeCompare(second, "en", { sensitivity: "base" }),
    );
    const correct = words.filter((word, index) => word === expected[index]).length;
    completed = correct === words.length;
    if (correct === words.length) {
      feedback.textContent = "Fantastic! Every word is in the right place!";
      restartButton.hidden = true;
      if (levelIndex === levels.length - 1) playAgainButton.hidden = false;
      else nextButton.hidden = false;
    } else {
      feedback.textContent = `Great try! ${correct} of ${words.length} words are in the right place. Keep dragging to fix the order, then check again!`;
    }
    undoButton.hidden = completed;
    render();
    if (completed) (nextButton.hidden ? playAgainButton : nextButton).focus();
    else checkButton.focus();
  }

  async function loadBank() {
    startButton.disabled = true;
    loadStatus.textContent = "Getting your words ready...";
    try {
      const response = await fetch(new URL("./words.json", import.meta.url));
      if (!response.ok) throw new Error(`Word bank request failed (${response.status}).`);
      bank = readWordBank(await response.json());
      levels.forEach((level) => selectWords(bank, level.mode));
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
      preferenceStatus.textContent = preferences.warning || savedMessage;
      themeSelect.disabled = false;
      startButton.disabled = false;
      startButton.textContent = "Let’s play!";
      loadStatus.textContent = "";
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
    tutorial.hidden = true;
    playArea.hidden = false;
    startLevel(0);
  });
  themeSelect.addEventListener("change", () => {
    selectedTheme = themeSelect.value;
    preferenceStatus.textContent = savePreferences(getStorage, selectedTheme) || savedMessage;
    if (!playArea.hidden) startLevel(0);
  });
  undoButton.addEventListener("click", () => {
    cancelDrag();
    words = history.pop();
    feedback.textContent = "";
    render();
  });
  checkButton.addEventListener("click", checkAnswers);
  restartButton.addEventListener("click", () => startLevel(levelIndex, false));
  nextButton.addEventListener("click", () => startLevel(levelIndex + 1));
  playAgainButton.addEventListener("click", () => startLevel(0));
  loadBank();
})();

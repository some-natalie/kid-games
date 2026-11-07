import { readWordBank, selectWords, shuffled } from "./alphabet-word-lists.mjs";

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
  const wordBank = document.querySelector("#word-bank");
  const answerList = document.querySelector("#answer-list");
  const progress = document.querySelector("#progress");
  const feedback = document.querySelector("#feedback");
  const undoButton = document.querySelector("#undo-word");
  const restartButton = document.querySelector("#restart-level");
  const nextButton = document.querySelector("#next-level");
  const playAgainButton = document.querySelector("#play-again");
  const startButton = document.querySelector("#start-game");
  const loadStatus = document.querySelector("#load-status");
  let bank;
  let roundWords = [];
  let levelIndex = 0;
  let words = [];
  let answers = [];
  let completed = false;

  function startLevel(index, newRound = true) {
    const level = levels[index];
    if (newRound) roundWords = selectWords(bank, level.mode);
    levelIndex = index;
    answers = [];
    completed = false;
    words = shuffled(roundWords);
    document.querySelector("#level-count").textContent = `Level ${levelIndex + 1} of ${levels.length}`;
    document.querySelector("#level-title").textContent = level.title;
    document.querySelector("#level-hint").textContent = level.hint;
    feedback.textContent = "";
    nextButton.hidden = true;
    playAgainButton.hidden = true;
    restartButton.hidden = false;
    restartButton.textContent = "Start over";
    undoButton.hidden = false;
    render();
    document.querySelector("#level-title").focus();
  }

  function render() {
    const chosen = new Set(answers);
    wordBank.replaceChildren();
    words.forEach((word) => {
      const button = document.createElement("button");
      button.className = "word-button";
      button.type = "button";
      button.textContent = word;
      button.disabled = completed || chosen.has(word);
      button.addEventListener("click", () => {
        answers.push(word);
        render();
        if (answers.length === words.length) checkAnswers();
      });
      wordBank.append(button);
    });

    answerList.replaceChildren();
    answers.forEach((word) => {
      const item = document.createElement("li");
      item.textContent = word;
      answerList.append(item);
    });
    progress.textContent = `${answers.length} of ${words.length} words placed`;
    undoButton.disabled = completed || answers.length === 0;
    restartButton.disabled = false;
  }

  function checkAnswers() {
    completed = true;
    const expected = [...roundWords].sort((first, second) =>
      first.localeCompare(second, "en", { sensitivity: "base" }),
    );
    const correct = answers.filter((word, index) => word === expected[index]).length;
    if (correct === words.length) {
      feedback.textContent = "Fantastic! Every word is in the right place!";
      restartButton.hidden = true;
      if (levelIndex === levels.length - 1) playAgainButton.hidden = false;
      else nextButton.hidden = false;
    } else {
      feedback.textContent = `Great try! ${correct} of ${words.length} words are in the right place. Start over and try again!`;
      restartButton.textContent = "Try again";
    }
    undoButton.hidden = true;
    render();
  }

  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    loadStatus.textContent = "Getting your words ready...";
    try {
      const response = await fetch(new URL("./words.json", import.meta.url));
      if (!response.ok) throw new Error(`Word bank request failed (${response.status}).`);
      bank = readWordBank(await response.json());
      levels.forEach((level) => selectWords(bank, level.mode));
      tutorial.hidden = true;
      playArea.hidden = false;
      startLevel(0);
      loadStatus.textContent = "";
    } catch (error) {
      console.error("Unable to start Alphabetical Adventure:", error);
      tutorial.hidden = false;
      playArea.hidden = true;
      loadStatus.textContent = "We couldn't load the words. Please try again.";
      startButton.disabled = false;
    }
  });
  undoButton.addEventListener("click", () => {
    answers.pop();
    feedback.textContent = "";
    render();
  });
  restartButton.addEventListener("click", () => startLevel(levelIndex, false));
  nextButton.addEventListener("click", () => startLevel(levelIndex + 1));
  playAgainButton.addEventListener("click", () => startLevel(0));
})();

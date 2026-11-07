(() => {
  const levels = [
    {
      title: "First-letter friends",
      hint: "Look at the first letter of each word.",
      words: ["apple", "ball", "cloud", "dolphin", "elephant", "flower", "garden", "happy", "island", "jacket", "kitten", "lemon"],
    },
    {
      title: "Look a little closer",
      hint: "Some words start with the same letter. Compare their second letters, too!",
      words: ["bag", "bat", "bed", "bee", "big", "bin", "bog", "box", "bug", "bun", "cab", "cot"],
    },
    {
      title: "Dinosaur challenge",
      hint: "Dinosaur names can be long! Compare letters from the beginning until you find a difference.",
      words: ["Ankylosaurus", "Apatosaurus", "Brachiosaurus", "Brontosaurus", "Compsognathus", "Corythosaurus", "Diplodocus", "Iguanodon", "Microraptor", "Stegosaurus", "Triceratops", "Tyrannosaurus"],
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
  let levelIndex = 0;
  let words = [];
  let answers = [];
  let completed = false;

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const otherIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
    }
    return result;
  }

  function startLevel(index) {
    levelIndex = index;
    answers = [];
    completed = false;
    const level = levels[levelIndex];
    words = shuffled(level.words);
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
    const expected = [...levels[levelIndex].words].sort((first, second) =>
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

  document.querySelector("#start-game").addEventListener("click", () => {
    tutorial.hidden = true;
    playArea.hidden = false;
    startLevel(0);
    document.querySelector("#level-title").focus();
  });
  undoButton.addEventListener("click", () => {
    answers.pop();
    feedback.textContent = "";
    render();
  });
  restartButton.addEventListener("click", () => startLevel(levelIndex));
  nextButton.addEventListener("click", () => startLevel(levelIndex + 1));
  playAgainButton.addEventListener("click", () => startLevel(0));
})();

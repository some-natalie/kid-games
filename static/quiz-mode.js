import { isQuizMode, QUIZ_NOTICE, gradeQuiz } from "./quiz-engine.js";
import { QUEST_LEVELS, readWordBank, selectLevelWords, selectThemeWords, playableThemes, shuffled } from "./alphabet-word-lists.js";
import { buildRound as proofRound, tokenKey, pickVariant, describeFix } from "./proofreading-engine.js";
import { LEVELS as PROOF_LEVELS } from "./proofreading-levels.js";
import { LEVELS as NUMBER_LEVELS, buildRound as numberRound, equationText } from "./number-trail-engine.js";
import { LEVELS as ACORN_LEVELS, buildJourney } from "./acorn-adventure-engine.js";
import { LEVELS as RIBBON_LEVELS, makeQuizQuestion as ribbonQuizQuestion } from "./ribbon-workshop-engine.js";
import { quizQuestions as pizzaQuestions } from "./picnic-pizza-engine.js";

const active = isQuizMode(window.location.search);
if (active) {
  document.documentElement.classList.add("quiz-mode");
  for (const link of document.querySelectorAll("a[href]")) {
    const url = new URL(link.href);
    if (url.origin === location.origin && !link.getAttribute("href").startsWith("#")) {
      url.searchParams.set("quiz", "1");
      link.href = url.href;
    }
  }
  const game = document.querySelector(".alphabet-game");
  if (game) setupQuiz(game);
  else {
    const notice = document.createElement("p");
    notice.className = "quiz-notice";
    notice.textContent = QUIZ_NOTICE;
    document.querySelector("main").prepend(notice);
  }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function makeQuestions(kind, bank, theme) {
  if (kind === "alphabet") {
    return QUEST_LEVELS.map((level, index) => {
      const words = theme === "general" ? selectLevelWords(bank, level) : selectThemeWords(bank, theme, level.count);
      const expected = [...words].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
      return { kind, title: `Level ${index + 1}: ${level.title}`, initial: shuffled(words), expected,
        prompt: "Put these words in ABC order. Use the Up and Down buttons to move them.",
        correction: `Correct order: ${expected.join(", ")}.` };
    });
  }
  if (kind === "proof") {
    return PROOF_LEVELS.map((level, index) => {
      const round = proofRound({ sentences: pickVariant(level) });
      const tokens = round.sentences.flatMap((sentence, s) => [
        ...sentence.tokens.map((token, t) => ({ ...token, key: tokenKey(s, t) })),
        { kind: "space", text: " " },
      ]);
      return { kind, title: `Level ${index + 1}: ${level.title}`, tokens, expected: tokens.filter((token) => token.kind === "mistake").map((token) => token.key),
        prompt: "Mark words, punctuation, or gaps that need fixing. Tap again to unmark. Leave correct text unmarked.",
        correction: tokens.filter((token) => token.kind === "mistake").map(describeFix).join(" ") };
    });
  }
  if (kind === "number") {
    return NUMBER_LEVELS.flatMap((level, index) => numberRound(index).map((problem, step) => ({
      kind, title: `Level ${index + 1}, stone ${step + 1}: ${level.title}`,
      prompt: equationText(problem), choices: problem.choices, expected: problem.answer,
      correction: `Correct equation: ${equationText(problem, true)}.`,
    })));
  }
  if (kind === "ribbon") return RIBBON_LEVELS.map((_, index) => ribbonQuizQuestion(index));
  if (kind === "pizza") return pizzaQuestions();
  return ACORN_LEVELS.flatMap((level, index) => {
    const journey = buildJourney(index);
    const expression = `${journey.start} ${journey.steps.map((step) =>
      `${step.operation === "+" ? "+" : "\u2212"} ${step.amount}`).join(" ")} = ?`;
    return journey.steps.map((step, position) => ({
      kind, title: `Level ${index + 1}, stop ${position + 1}: ${level.title}`,
      prompt: expression, expected: step.total, step, start: journey.start, position,
      correction: `Correct journey total at this stop: ${step.before} ${step.operation === "+" ? "+" : "\u2212"} ${step.amount} = ${step.total}.`,
    }));
  });
}

function setupQuiz(game) {
  const name = game.getAttribute("aria-label");
  const kind = game.classList.contains("ribbon-workshop") ? "ribbon" : game.classList.contains("acorn-game")
    ? "acorn" : game.classList.contains("number-trail") ? "number"
      : game.classList.contains("proofreading-game") ? "proof"
        : game.classList.contains("picnic-pizza-game") ? "pizza" : "alphabet";
  game.replaceChildren();
  const notice = element("p", QUIZ_NOTICE, "quiz-notice");
  const area = element("div");
  const status = element("p");
  status.setAttribute("role", "status");
  game.append(notice, area, status);
  document.querySelector(".alphabet-rail")?.remove();
  document.body.classList.remove("with-alphabet-rail");
  let questions = [];
  let responses = [];
  let current = 0;
  let bank;
  let theme = "general";

  const button = (text, action, primary = false) => {
    const node = element("button", text, primary ? "primary-button" : "secondary-button");
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  };

  function showStart() {
    notice.textContent = QUIZ_NOTICE;
    area.replaceChildren(element("h2", `${name} quiz`),
      element("p", "There are no hints or answer checks during the quiz. Use Next question to continue and Previous question to revise. Review your answers before submitting. Quiz answers are not saved when you leave this page."));
    if (kind === "alphabet") {
      const label = element("label", "Pick your theme ");
      const select = element("select");
      for (const option of [{ id: "general", label: "ABC adventure (all topics)" }, ...playableThemes(bank)]) {
        const node = element("option", option.label);
        node.value = option.id;
        select.append(node);
      }
      select.value = theme;
      select.addEventListener("change", () => { theme = select.value; });
      label.append(select);
      area.append(label);
    }
    area.append(button("Start quiz", () => {
      questions = makeQuestions(kind, bank, theme);
      responses = questions.map((question) => question.kind === "alphabet" ? [...question.initial]
        : question.kind === "proof" || question.multiple ? [] : undefined);
      current = 0;
      showQuestion();
    }, true));
  }

  function showQuestion() {
    status.textContent = "";
    const question = questions[current];
    const heading = element("h2", question.title);
    heading.id = "quiz-question-heading";
    heading.tabIndex = -1;
    area.replaceChildren(element("p", `Question ${current + 1} of ${questions.length}`, "eyebrow"), heading, element("p", question.prompt));
    if (kind === "alphabet") renderWords();
    if (kind === "proof") renderProof(question);
    if (kind === "number") {
      const choices = element("div", undefined, "answer-stones");
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-labelledby", heading.id);
      question.choices.forEach((value) => {
        const choice = button(String(value), () => {
          responses[current] = value;
          for (const item of choices.children) item.setAttribute("aria-pressed", String(item === choice));
          status.textContent = "Answer selected. You can change it before submitting.";
        });
        choice.setAttribute("aria-pressed", String(responses[current] === value));
        choices.append(choice);
      });
      area.append(choices);
    }
    if (kind === "ribbon") {
      const choices = element("div", undefined, "answer-stones");
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-labelledby", heading.id);
      question.choices.forEach(({ value, label }) => {
        const choice = button(label, () => {
          responses[current] = value;
          for (const item of choices.children) item.setAttribute("aria-pressed", String(item === choice));
          status.textContent = "Answer selected. You can change it before submitting.";
        });
        choice.setAttribute("aria-pressed", String(responses[current] === value));
        choices.append(choice);
      });
      area.append(choices);
    }
    if (kind === "pizza") {
      area.append(element("p", question.visualDescription));
      const choices = element("div", undefined, "answer-stones");
      choices.setAttribute("role", "group");
      choices.setAttribute("aria-labelledby", heading.id);
      question.choices.forEach((value) => {
        const choice = button(value, () => {
          if (question.multiple) {
            const selected = responses[current] ?? [];
            const position = selected.indexOf(value);
            if (position === -1) selected.push(value);
            else selected.splice(position, 1);
            responses[current] = selected;
          } else {
            responses[current] = value;
          }
          for (const item of choices.children) {
            const pressed = question.multiple
              ? responses[current].includes(item.value) : item.value === responses[current];
            item.setAttribute("aria-pressed", String(pressed));
          }
          status.textContent = "Answer selected. You can change it before submitting.";
        });
        choice.value = value;
        const selected = responses[current];
        choice.setAttribute("aria-pressed", String(question.multiple
          ? Array.isArray(selected) && selected.includes(value) : selected === value));
        choices.append(choice);
      });
      area.append(choices);
    }
    if (kind === "acorn") {
      area.append(element("p", "Use your previous answer as the running total. If you revise an earlier answer, review the later stops too; they do not change automatically. Each stop is scored against the original journey."));
      const before = question.position === 0 ? question.start : responses[current - 1];
      area.append(element("p", before === undefined || before === "" ? "The previous stop has no answer yet." : `Your carried total: ${before} nuts.`));
      area.append(element("p", `${question.step.operation === "+" ? "Gather" : "Share"} ${question.step.amount} nuts at this stop.`));
      const label = element("label", "Your new basket total ");
      const input = element("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";
      input.value = responses[current] ?? "";
      input.addEventListener("input", () => { responses[current] = input.value; });
      label.append(input);
      area.append(label);
    }
    const navigation = element("div", undefined, "game-actions quiz-navigation");
    const previous = button("Previous question", () => { current -= 1; showQuestion(); });
    previous.disabled = current === 0;
    const next = button(current === questions.length - 1 ? "Review answers" : "Next question", () => {
      if (kind === "acorn" && responses[current] !== undefined && responses[current] !== "" &&
          (!Number.isInteger(Number(responses[current])) || Number(responses[current]) < 0)) {
        status.textContent = "Enter a whole number of nuts, zero or more.";
        return;
      }
      if (current === questions.length - 1) showReview();
      else { current += 1; showQuestion(); }
    }, true);
    navigation.append(previous, next);
    if (current !== questions.length - 1) navigation.append(button("Review answers", showReview));
    area.append(navigation);
    heading.focus();
  }

  function renderWords(focusPosition, direction) {
    area.querySelector(".quiz-words")?.remove();
    const list = element("ol", undefined, "quiz-words");
    responses[current].forEach((word, position) => {
      const item = element("li");
      item.append(element("span", word));
      for (const [label, delta] of [["Up", -1], ["Down", 1]]) {
        const move = button(label, () => {
          const order = responses[current];
          [order[position], order[position + delta]] = [order[position + delta], order[position]];
          renderWords(position + delta, label);
        });
        move.setAttribute("aria-label", `Move ${word} ${label.toLowerCase()}`);
        move.disabled = position + delta < 0 || position + delta >= responses[current].length;
        item.append(move);
      }
      list.append(item);
    });
    const navigation = area.querySelector(".quiz-navigation");
    area.insertBefore(list, navigation);
    if (focusPosition !== undefined) {
      const item = list.children[focusPosition];
      const target = item.querySelector(`button[aria-label$="${direction.toLowerCase()}"]`);
      (target.disabled ? item.querySelector("button:not(:disabled)") : target).focus();
    }
  }

  function renderProof(question) {
    const text = element("p", undefined, "proof-text");
    text.setAttribute("role", "group");
    text.setAttribute("aria-label", "Text to proofread");
    question.tokens.forEach((token) => {
      if (token.kind === "space") { text.append(token.text); return; }
      const target = button("", () => {
        const marks = responses[current];
        const position = marks.indexOf(token.key);
        if (position === -1) marks.push(token.key);
        else marks.splice(position, 1);
        target.setAttribute("aria-pressed", String(marks.includes(token.key)));
      });
      target.className = "proof-token";
      const word = /\w/.test(token.text);
      target.dataset.kind = word ? "word" : "mark";
      if (!word && token.text.trim()) target.classList.add("proof-punctuation");
      if (!token.text.trim()) target.classList.add("proof-gap");
      target.setAttribute("aria-label", token.text.trim() ? token.text : "wide space between words");
      target.setAttribute("aria-pressed", String(responses[current].includes(token.key)));
      if (token.parts) {
        for (const part of token.parts) target.append(element("span", part.text, part.mirrored ? "mirrored" : ""));
      } else target.textContent = token.text;
      text.append(target);
    });
    area.append(text, button("Clear marks", () => { responses[current] = []; showQuestion(); }));
  }

  function showReview() {
    if (kind === "acorn" && responses.some((response) => response !== undefined && response !== "" &&
        (!Number.isInteger(Number(response)) || Number(response) < 0))) {
      status.textContent = "Enter whole numbers of nuts, zero or more, before reviewing.";
      return;
    }
    status.textContent = "";
    const heading = element("h2", "Review your answers");
    heading.tabIndex = -1;
    area.replaceChildren(heading, element("p", "You can still change any answer. Submit quiz when you are ready to see your results."));
    const list = element("ol", undefined, "quiz-review");
    questions.forEach((question, index) => {
      const item = element("li");
      const answer = responses[index];
      const description = kind === "proof" ? `${answer.length} items marked`
        : kind === "ribbon" ? question.choices.find((choice) => choice.value === answer)?.label ?? "No answer"
        : Array.isArray(answer) ? answer.join(", ") : answer === undefined || answer === "" ? "No answer" : String(answer);
      item.append(element("p", `${question.title}: ${description}`),
        button(`Edit question ${index + 1}`, () => { current = index; showQuestion(); }));
      list.append(item);
    });
    area.append(list, button("Submit quiz", showResults, true));
    heading.focus();
  }

  function showResults() {
    const grade = gradeQuiz(questions, responses);
    const heading = element("h2", "Show your parent!");
    heading.id = "quest-heading";
    heading.tabIndex = -1;
    area.replaceChildren();
    area.id = "quest-complete";
    area.append(heading, element("p", `${grade.percent}% correct (${grade.correct} of ${grade.total} questions)`, "quiz-score"));
    const details = element("details");
    details.append(element("summary", "Answer details"));
    const list = element("ol");
    for (const { question, response, correct } of grade.results) {
      const item = element("li");
      item.append(element("strong", `${question.title}: ${correct ? "Correct" : "Incorrect"}`));
      item.append(element("p", question.prompt));
      if (!correct) {
        const answer = question.kind === "ribbon"
          ? question.choices.find((choice) => choice.value === response)?.label ?? "No answer"
          : Array.isArray(response)
          ? question.kind === "proof" ? question.tokens.filter((token) => response.includes(token.key)).map((token) => token.text.trim() || "wide gap").join(", ") || "No marks"
            : response.join(", ")
          : response === undefined || response === "" ? "No answer" : String(response);
        item.append(element("p", `Your answer: ${answer}. ${question.correction}`));
        if (question.kind === "proof") {
          const missed = question.expected.filter((key) => !response.includes(key)).length;
          const falseMarks = response.filter((key) => !question.expected.includes(key)).length;
          item.append(element("p", `Mistakes missed: ${missed}. Correct items marked by mistake: ${falseMarks}.`));
          item.append(element("p", `Text: ${question.tokens.map((token) => token.text).join("")}`));
        }
      }
      list.append(item);
    }
    details.append(list);
    area.append(details, button("Start a new quiz", () => { area.removeAttribute("id"); showStart(); }));
    heading.focus();
    notice.textContent = "Quiz finished. Your results are below. One point is awarded for each completely correct question.";
  }

  if (kind === "alphabet") {
    status.textContent = "Loading quiz words...";
    fetch(new URL("./words.json", import.meta.url)).then((response) => {
      if (!response.ok) throw new Error(`Word bank request failed (${response.status}).`);
      return response.json();
    }).then((data) => { bank = readWordBank(data); status.textContent = ""; showStart(); }).catch((error) => {
      console.error("Unable to load quiz words:", error);
      status.textContent = "We couldn't load quiz words. Reload the page to try again.";
    });
  } else showStart();
}

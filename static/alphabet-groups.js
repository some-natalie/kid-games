import { isQuizMode } from "./quiz-engine.js";
import { celebrate, DEFAULT_CELEBRATIONS, readCelebrations, stopCelebration } from "./alphabet-celebration.js";
import { readWordBank, shuffled } from "./alphabet-word-lists.js";
import { clearProgress, loadProgress, saveProgress } from "./alphabet-progress.js";
import {
  GROUP_LEVELS, GROUPS_PROGRESS, checkWorkspace, createWorkspace, groupRound, validWorkspace,
} from "./alphabet-groups-engine.js";
import { mountWorkspace } from "./alphabet-groups-workspace.js";

if (new URLSearchParams(location.search).get("sort") === "groups" && !isQuizMode(location.search)) {
  startGroups();
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function startGroups() {
  const game = document.querySelector(".alphabet-game");
  game.replaceChildren();
  const storage = () => localStorage;
  const warning = element("p", "Your working lists are saved only in this browser.");
  warning.setAttribute("role", "status");
  const tutorial = element("div", undefined, "tutorial");
  const heading = element("h2", "Sort smaller lists, then build your big ABC list");
  tutorial.append(heading,
    element("p", "Make lists for first letters. If words start the same way, move them into smaller lists and compare the second, third, fourth letter, or farther. You choose the groups and their order."),
    element("h3", "Worked example: compare from the beginning"),
    element("p", "Start with car, cart, and cat in a c list, then a ca list. Make a car list for car and cart, and a cat list for cat. In the car list, the fourth position decides: car ends, so it comes before cart. Send car, cart, then cat to the final ABC list."),
    element("p", "Only compare a later letter after all earlier letters match. If one word ends at a shared prefix, the shorter word comes first."),
    element("p", "Seven levels go from first-letter groups to seventh-letter comparisons. Use buttons or keyboard controls; no dragging is required. Check only after gathering every word in the final ABC list."));
  const load = element("p", "Loading words...");
  load.setAttribute("role", "status");
  const play = element("div");
  play.hidden = true;
  game.append(warning, tutorial, load, play);
  let bank;
  let saved;
  let index = 0;
  let round;
  let workspace;
  let view;
  let celebrations = DEFAULT_CELEBRATIONS;

  const button = (text, action, primary = false) => {
    const node = element("button", text, primary ? "primary-button" : "secondary-button");
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  };
  function warn(message) {
    if (message) {
      warning.textContent = message;
      warning.classList.add("warning");
    }
  }
  function persist() {
    warn(saveProgress(storage, GROUPS_PROGRESS, { level: index, roundWords: round, workspace }));
  }
  function valid(saved) {
    return saved && Number.isInteger(saved.level) && GROUP_LEVELS[saved.level] &&
      Array.isArray(saved.roundWords) && saved.roundWords.length === GROUP_LEVELS[saved.level].count &&
      saved.roundWords.every((word) => bank.some((entry) =>
        entry.word === word && entry.tags.has("general") && !entry.tags.has("advanced") && /^[a-z]+$/i.test(word))) &&
      validWorkspace(saved.workspace, saved.roundWords);
  }
  function begin(level, restore) {
    index = level;
    round = restore?.roundWords ?? groupRound(bank, index);
    workspace = restore?.workspace ?? createWorkspace(shuffled(round));
    tutorial.hidden = true;
    play.hidden = false;
    stopCelebration();
    play.replaceChildren();
    const title = element("h2", GROUP_LEVELS[index].title);
    title.id = "level-title";
    title.tabIndex = -1;
    const count = element("p", `Level ${index + 1} of ${GROUP_LEVELS.length}`, "eyebrow");
    count.id = "level-count";
    const help = element("details", undefined, "how-to-play");
    help.append(element("summary", "How to use working lists"),
      element("p", "Create a named list, select a word, choose its destination, and move it. Create smaller lists when earlier letters match. Use Up/Down or arrow keys, Home, and End to arrange words within a list. Send a whole list to the end of the final list in your chosen order. Move words back out to revise, or undo a change."));
    const progress = element("p", "", "progress");
    const boards = element("div");
    const feedback = element("p", "", "feedback");
    feedback.id = "feedback";
    feedback.setAttribute("role", "status");
    const updateCount = () => {
      progress.textContent = `${workspace.lists.find((list) => list.id === "final").words.length} of ${round.length} words in your final ABC list`;
    };
    const check = button("Check order", () => {
      const result = checkWorkspace(workspace, round);
      if (!result.complete) {
        feedback.textContent = "Gather every word in the final ABC list before checking. You can still change all your working lists.";
        check.focus();
        return;
      }
      if (!result.solved) {
        feedback.textContent = `${result.correct} of ${round.length} words are in the right place. Compare from the beginning, regroup matching words, and try again.`;
        check.focus();
        return;
      }
      const { message: cheer } = celebrate(celebrations);
      feedback.textContent = `${cheer} Every word is in the right place. Your smaller lists made one big ABC list.`;
      feedback.classList.add("success");
      view.lock();
      check.disabled = true;
      if (index + 1 < GROUP_LEVELS.length) {
        const nextRound = groupRound(bank, index + 1);
        warn(saveProgress(storage, GROUPS_PROGRESS, {
          level: index + 1, roundWords: nextRound, workspace: createWorkspace(nextRound),
        }));
        const next = button("Next level", () => begin(index + 1), true);
        actions.append(next);
        next.focus();
      } else {
        warn(clearProgress(storage, GROUPS_PROGRESS));
        const finish = button("Finish sorting", () => {
          play.replaceChildren();
          const finale = element("h2", "Show your parent!");
          finale.tabIndex = -1;
          play.append(finale, element("p", "You compared words from the first letter all the way to the seventh!"),
            button("Play again", () => begin(0), true));
          finale.focus();
          celebrate(celebrations);
        }, true);
        actions.append(finish);
        finish.focus();
      }
    }, true);
    const restart = button("Start this level over", () => begin(index, { roundWords: round, workspace: createWorkspace(shuffled(round)) }));
    const actions = element("div", undefined, "game-actions");
    actions.append(check, restart);
    play.append(count, title, help, progress, boards, feedback, actions);
    view = mountWorkspace(boards, workspace, (state) => {
      workspace = state;
      feedback.textContent = "";
      feedback.classList.remove("success");
      updateCount();
      persist();
    });
    updateCount();
    persist();
    title.focus();
  }
  const start = button("Start sorting in groups", () => begin(saved?.level ?? 0, saved), true);
  start.id = "start-game";
  start.disabled = true;
  tutorial.append(start);
  const retry = button("Try loading words again", loadWords);
  retry.hidden = true;
  game.append(retry);
  async function loadWords() {
    start.disabled = true;
    retry.hidden = true;
    load.textContent = "Loading words...";
    try {
      const response = await fetch(new URL("./words.json", import.meta.url));
      if (!response.ok) throw new Error(`Word bank request failed (${response.status}).`);
      bank = readWordBank(await response.json());
      GROUP_LEVELS.forEach((_, level) => groupRound(bank, level));
      const result = loadProgress(storage, GROUPS_PROGRESS, valid);
      warn(result.warning);
      saved = result.progress;
      if (saved) {
        start.textContent = `Keep sorting level ${saved.level + 1}`;
        if (!tutorial.querySelector("#new-group-quest")) {
          const fresh = button("Start a new sorting quest", () => begin(0));
          fresh.id = "new-group-quest";
          tutorial.append(fresh);
        }
      }
      load.textContent = "";
      start.disabled = false;
    } catch (error) {
      console.error("Unable to load letter-group sorting:", error);
      load.textContent = "We couldn't load the words. Try loading them again.";
      retry.hidden = false;
    }
  }
  async function loadCelebrations() {
    try {
      const response = await fetch(new URL("./celebrations.json", import.meta.url));
      if (!response.ok) throw new Error(`Celebrations request failed (${response.status}).`);
      celebrations = readCelebrations(await response.json());
    } catch (error) {
      console.warn("Using built-in celebrations:", error);
    }
  }
  loadCelebrations();
  loadWords();
}

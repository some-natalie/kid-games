import { celebrate, stopCelebration } from "./alphabet-celebration.js";
import { GAME_CELEBRATIONS } from "./game-celebrations.js";
import { createLevelProgress } from "./level-progress.js";
import { isQuizMode } from "./quiz-engine.js";
import {
  LEVELS, adjustBlock, comparisonExplanation, exchangeBlocks, isLevelComplete,
  makeBlocks, representedNumber,
} from "./place-value-builders-engine.js";

if (!isQuizMode(window.location.search)) {
  const { loadProgress, saveProgress, clearProgress } =
    createLevelProgress("kid-games.place-value-builders.progress", "Place-Value Builders");
  const storage = () => window.localStorage;
  const find = (id) => document.getElementById(id);
  const tutorial = find("tutorial");
  const playArea = find("play-area");
  const finale = find("quest-complete");
  const status = find("preference-status");
  const feedback = find("feedback");
  const hint = find("place-value-hint");
  let savedLevel;
  let levelIndex = 0;
  let blocks;
  let selectedComparison = "";
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
      item.className = index < levelIndex ? "done" : index === levelIndex ? "current" : "";
      item.setAttribute("aria-label", `Level ${index + 1}: ${level.title}${index < levelIndex ? ", finished" : ""}`);
      if (index === levelIndex) item.setAttribute("aria-current", "step");
      return item;
    }));
  }

  function numberParts(number) {
    const hundreds = Math.floor(number / 100);
    const tens = Math.floor(number / 10) % 10;
    const ones = number % 10;
    return { hundreds, tens, ones };
  }

  function placeName(place, count) {
    const name = { hundreds: "hundred", tens: "ten", ones: "one" }[place];
    return `${count} ${name}${count === 1 ? "" : "s"}`;
  }

  function drawPlace(container, place, count, labelPrefix = "") {
    const column = document.createElement("section");
    column.className = "place-value-column";
    const heading = document.createElement("h3");
    heading.textContent = `${place[0].toUpperCase()}${place.slice(1)}`;
    const amount = document.createElement("p");
    amount.className = "place-value-count";
    amount.textContent = `${labelPrefix}${count} ${placeName(place, count)}`;
    const pieces = document.createElement("div");
    pieces.className = `place-value-pieces place-value-${place}`;
    pieces.setAttribute("aria-hidden", "true");
    const shown = Math.min(count, 20);
    for (let index = 0; index < shown; index += 1) {
      const piece = document.createElement("span");
      piece.className = "place-value-piece";
      piece.textContent = place === "hundreds" ? "100" : place === "tens" ? "10" : "1";
      pieces.append(piece);
    }
    if (count > shown) {
      const more = document.createElement("span");
      more.className = "place-value-more";
      more.textContent = `+${count - shown}`;
      pieces.append(more);
    }
    column.append(heading, amount, pieces);
    container.append(column);
  }

  function drawBlocks() {
    const workspace = find("block-workspace");
    workspace.replaceChildren();
    for (const place of ["hundreds", "tens", "ones"]) drawPlace(workspace, place, blocks[place]);
    find("number-readout").textContent =
      `Number: ${representedNumber(blocks)}. ${placeName("hundreds", blocks.hundreds)}, ` +
      `${placeName("tens", blocks.tens)}, and ${placeName("ones", blocks.ones)}.`;
    const controls = find("block-controls");
    controls.replaceChildren();
    for (const place of ["hundreds", "tens", "ones"]) {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "place-value-controls";
      const legend = document.createElement("legend");
      legend.textContent = `${place[0].toUpperCase()}${place.slice(1)} blocks`;
      fieldset.append(legend);
      const row = document.createElement("div");
      row.className = "place-value-control-row";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "secondary-button";
      add.textContent = `Add 1 ${place === "hundreds" ? "hundred" : place === "tens" ? "ten" : "one"}`;
      add.setAttribute("aria-label", `Add one ${place.slice(0, -1)} block`);
      add.disabled = solved || representedNumber(blocks) + { hundreds: 100, tens: 10, ones: 1 }[place] > 999;
      add.addEventListener("click", () => changeBlock(place, 1));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary-button";
      remove.textContent = `Remove 1 ${place === "hundreds" ? "hundred" : place === "tens" ? "ten" : "one"}`;
      remove.setAttribute("aria-label", `Remove one ${place.slice(0, -1)} block`);
      remove.disabled = solved || blocks[place] === 0;
      remove.addEventListener("click", () => changeBlock(place, -1));
      row.append(add, remove);
      fieldset.append(row);
      if (place !== "hundreds") {
        const exchanges = document.createElement("div");
        exchanges.className = "place-value-control-row";
        const bundle = document.createElement("button");
        bundle.type = "button";
        bundle.className = "secondary-button";
        const higher = place === "ones" ? "one ten" : "one hundred";
        bundle.textContent = `Exchange 10 ${place} for ${higher}`;
        bundle.setAttribute("aria-label", `Exchange 10 ${place} for ${higher}`);
        bundle.disabled = solved || blocks[place] < 10;
        bundle.addEventListener("click", () => exchange(place, "up"));
        const unbundle = document.createElement("button");
        unbundle.type = "button";
        unbundle.className = "secondary-button";
        const lower = place === "ones" ? "ones" : "tens";
        unbundle.textContent = `Exchange 1 ${higher.replace("one ", "")} for 10 ${lower}`;
        unbundle.setAttribute("aria-label", `Exchange 1 ${higher.replace("one ", "")} for 10 ${lower}`);
        unbundle.disabled = solved || blocks[place === "ones" ? "tens" : "hundreds"] < 1;
        unbundle.addEventListener("click", () => exchange(place, "down"));
        exchanges.append(bundle, unbundle);
        fieldset.append(exchanges);
      }
      controls.append(fieldset);
    }
  }

  function drawComparison(level) {
    const models = find("comparison-models");
    models.replaceChildren();
    for (const [label, value, side] of [["First number", level.left, "left"], ["Second number", level.right, "right"]]) {
      const model = document.createElement("section");
      model.className = "comparison-model";
      const heading = document.createElement("h3");
      heading.textContent = `${label}: ${value}`;
      const columns = document.createElement("div");
      columns.className = "place-value-workspace";
      const parts = numberParts(value);
      for (const place of ["hundreds", "tens", "ones"]) drawPlace(columns, place, parts[place]);
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "secondary-button";
      choose.textContent = `Choose ${value}`;
      choose.setAttribute("aria-pressed", String(selectedComparison === side));
      choose.setAttribute("aria-label", `Choose ${value}`);
      choose.disabled = solved;
      choose.addEventListener("click", () => {
        selectedComparison = side;
        feedback.textContent = "";
        drawComparison(level);
        models.querySelector(`[aria-label="Choose ${value}"]`)?.focus();
      });
      model.append(heading, columns, choose);
      models.append(model);
    }
  }

  function changeBlock(place, amount) {
    if (solved) return;
    try {
      blocks = adjustBlock(blocks, place, amount);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return;
    }
    feedback.textContent = "";
    hint.hidden = true;
    drawBlocks();
    const verb = amount > 0 ? "Add" : "Remove";
    find("block-controls").querySelector(`[aria-label="${verb} one ${place.slice(0, -1)} block"]`)?.focus();
  }

  function exchange(place, direction) {
    if (solved) return;
    blocks = exchangeBlocks(blocks, place, direction);
    if (!blocks) return;
    feedback.textContent = "";
    hint.hidden = true;
    drawBlocks();
    const label = direction === "up"
      ? `Exchange 10 ${place} for ${place === "ones" ? "one ten" : "one hundred"}`
      : `Exchange 1 ${place === "ones" ? "ten" : "hundred"} for 10 ${place === "ones" ? "ones" : "tens"}`;
    find("block-controls").querySelector(`[aria-label="${label}"]`)?.focus();
  }

  function showHint() {
    hint.hidden = false;
    hint.textContent = LEVELS[levelIndex].hint;
  }

  function check() {
    if (solved) return;
    const level = LEVELS[levelIndex];
    if (isLevelComplete(levelIndex, blocks, selectedComparison)) {
      solved = true;
      feedback.className = "feedback success";
      const explanation = level.type === "build"
        ? `${level.target} is ${placeName("hundreds", blocks.hundreds)}, ${placeName("tens", blocks.tens)}, and ${placeName("ones", blocks.ones)}.`
        : comparisonExplanation(level.left, level.right);
      const { message } = celebrate(GAME_CELEBRATIONS["place-value-builders"]);
      feedback.textContent = `${message} ${explanation}`;
      hint.hidden = true;
      find("check-build").hidden = true;
      const next = find("next-level");
      next.textContent = levelIndex === LEVELS.length - 1 ? "Finish building" : "Next level";
      next.hidden = false;
      showWarning(saveProgress(storage, levelIndex));
      if (level.type === "build") drawBlocks();
      else drawComparison(level);
      next.focus();
      return;
    }
    feedback.className = "feedback";
    feedback.textContent = level.type === "build"
      ? "Not quite yet. Keep building and regrouping; you can try as many times as you need."
      : "Choose the greater quantity. Compare the place values and try again.";
    showHint();
  }

  function startLevel(index) {
    levelIndex = index;
    blocks = LEVELS[index].type === "build"
      ? makeBlocks(...["hundreds", "tens", "ones"].map((place) => LEVELS[index].start[place]))
      : makeBlocks();
    selectedComparison = "";
    solved = false;
    stopCelebration();
    tutorial.hidden = true;
    finale.hidden = true;
    playArea.hidden = false;
    document.body.classList.add("is-playing");
    feedback.className = "feedback";
    feedback.textContent = "";
    hint.hidden = true;
    find("check-build").hidden = false;
    find("next-level").hidden = true;
    find("level-count").textContent = `Level ${index + 1} of ${LEVELS.length}`;
    find("level-title").textContent = LEVELS[index].title;
    find("level-instructions").textContent = LEVELS[index].instructions;
    find("build-area").hidden = LEVELS[index].type !== "build";
    find("comparison-area").hidden = LEVELS[index].type !== "compare";
    drawMap();
    if (LEVELS[index].type === "build") drawBlocks();
    else drawComparison(LEVELS[index]);
    find("level-title").focus();
  }

  function finish() {
    stopCelebration();
    showWarning(clearProgress(storage));
    savedLevel = undefined;
    playArea.hidden = true;
    finale.hidden = false;
    document.body.classList.remove("is-playing");
    celebrate(GAME_CELEBRATIONS["place-value-builders"]);
    find("quest-heading").focus();
  }

  find("start-game").addEventListener("click", () => startLevel(savedLevel ?? 0));
  find("new-quest").addEventListener("click", () => {
    showWarning(clearProgress(storage));
    savedLevel = undefined;
    startLevel(0);
  });
  find("check-build").addEventListener("click", check);
  find("show-hint").addEventListener("click", showHint);
  find("next-level").addEventListener("click", () => {
    if (levelIndex === LEVELS.length - 1) finish();
    else startLevel(levelIndex + 1);
  });
  find("play-again").addEventListener("click", () => {
    showWarning(clearProgress(storage));
    savedLevel = undefined;
    startLevel(0);
  });

  const progress = loadProgress(storage, LEVELS.length);
  savedLevel = progress.level;
  showWarning(progress.warning);
  if (savedLevel !== undefined) {
    find("start-game").textContent = `Continue level ${savedLevel + 1}`;
    find("new-quest").hidden = false;
  }
}

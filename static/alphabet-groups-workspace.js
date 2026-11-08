import {
  addList, changeDepth, finalWords, removeList, reorderWord, sendList, transferWord,
} from "./alphabet-groups-engine.js";

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

// This workspace never decides whether a grouping or an order is correct.
export function mountWorkspace(container, initial, onChange, { quiz = false } = {}) {
  let state = initial;
  let selected;
  let history = [];
  let locked = false;
  const allWords = initial.lists.flatMap((list) => list.words);
  const maxDepth = Math.max(...allWords.map((word) => word.length));
  const status = node("p", "", "group-workspace-status");
  status.setAttribute("role", "status");
  const tools = node("div", undefined, "group-tools");
  const boards = node("div", undefined, "group-boards");
  container.replaceChildren(tools, status, boards);
  container.classList.add("group-workspace");

  function button(text, action, label) {
    const control = node("button", text, "secondary-button");
    control.type = "button";
    if (label) control.setAttribute("aria-label", label);
    control.disabled = locked;
    control.addEventListener("click", action);
    return control;
  }

  function depths(labelText, value, action) {
    const label = node("label", labelText);
    const select = node("select");
    select.setAttribute("aria-label", labelText);
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const option = node("option", `Letter ${depth}`);
      option.value = String(depth);
      select.append(option);
    }
    select.value = String(value);
    select.disabled = locked;
    if (action) select.addEventListener("change", () => action(Number(select.value)));
    label.append(select);
    return { label, select };
  }

  function focusWord(word) {
    const control = [...boards.querySelectorAll("[data-word]")].find((item) => item.dataset.word === word);
    control?.focus();
  }

  function update(next, message, focus) {
    history.push(state);
    state = next;
    onChange(state);
    render();
    status.textContent = message;
    if (focus) focusWord(focus);
    else tools.querySelector("input").focus();
  }

  function render() {
    tools.replaceChildren();
    const nameLabel = node("label", "New list name");
    const name = node("input");
    name.type = "text";
    name.maxLength = 40;
    name.placeholder = quiz ? "Name your list" : "For example: c, ca, car";
    name.disabled = locked;
    nameLabel.append(name);
    const depth = depths("Compare letter in the new list", 1);
    const create = button("Create working list", () => {
      if (!name.value.trim()) {
        status.textContent = "Give your working list a name.";
        name.focus();
        return;
      }
      if (state.lists.some((list) => list.name.toLowerCase() === name.value.trim().toLowerCase())) {
        status.textContent = "Choose a different name for each working list.";
        name.focus();
        return;
      }
      update(addList(state, name.value, Number(depth.select.value)), `Created working list ${name.value.trim()}.`);
    });
    create.disabled = locked || state.lists.length >= allWords.length + 2;
    const undo = button("Undo workspace move", () => {
      state = history.pop();
      onChange(state);
      render();
      status.textContent = "Undid the last workspace change.";
      if (selected) focusWord(selected);
      else tools.querySelector("input").focus();
    });
    undo.disabled = locked || history.length === 0;
    tools.append(nameLabel, depth.label, create, undo);

    const chosen = state.lists.find((list) => list.words.includes(selected));
    const destinationLabel = node("label", selected ? `Move ${selected} to` : "Move selected word to");
    const destination = node("select");
    destination.setAttribute("aria-label", selected ? `Move ${selected} to` : "Move selected word to");
    destination.dataset.wordDestination = "";
    const placeholder = node("option", "Choose a list");
    placeholder.value = "";
    destination.append(placeholder);
    for (const list of state.lists) {
      if (list === chosen) continue;
      const option = node("option", `${list.name}${list.id.startsWith("group-") ? ` (${list.id.slice(6)})` : ""}`);
      option.value = list.id;
      destination.append(option);
    }
    destination.disabled = locked || !chosen;
    destinationLabel.append(destination);
    const move = button("Move selected word", () => {
      if (!destination.value) {
        status.textContent = "Choose a destination list.";
        destination.focus();
        return;
      }
      const target = state.lists.find((list) => list.id === destination.value);
      update(transferWord(state, selected, destination.value), `${selected} moved to ${target.name}.`, selected);
    });
    move.disabled = locked || !chosen;
    tools.append(destinationLabel, move);

    boards.replaceChildren();
    for (const list of state.lists) {
      const board = node("section", undefined, "group-board");
      board.dataset.list = list.id;
      const heading = node("h3", `${list.name}${list.id.startsWith("group-") ? ` (${list.id.slice(6)})` : ""}`);
      heading.id = `workspace-${list.id}`;
      board.setAttribute("aria-labelledby", heading.id);
      board.append(heading);
      if (list.id !== "final") {
        const picker = depths(`Compare letter in ${list.name}`, list.depth, (depth) => {
          history.push(state);
          state = changeDepth(state, list.id, depth);
          onChange(state);
          render();
          status.textContent = `${list.name} is now comparing letter ${depth}.`;
          boards.querySelector(`[data-list="${list.id}"] select`).focus();
        });
        board.append(picker.label);
        const send = button("Send list to final ABC list", () =>
          update(sendList(state, list.id), `${list.name} sent to the end of the final ABC list, in your chosen order.`, list.words[0]),
        `Send ${list.name} to final ABC list`);
        send.disabled = locked || list.words.length === 0;
        board.append(send);
      }
      if (list.id.startsWith("group-")) {
        const remove = button("Remove empty list", () =>
          update(removeList(state, list.id), `Removed empty list ${list.name}.`), `Remove empty list ${list.name}`);
        remove.disabled = locked || list.words.length > 0;
        board.append(remove);
      }
      const words = node("ol", undefined, "group-words");
      words.setAttribute("aria-label", `Words in ${list.name}`);
      list.words.forEach((word, index) => {
        const item = node("li");
        const select = button("", () => {
          selected = word;
          render();
          status.textContent = `${word} selected. Choose a destination, then move the word.`;
          tools.querySelector("[data-word-destination]").focus();
        }, `Select ${word}, position ${index + 1} of ${list.words.length} in ${list.name}`);
        select.dataset.word = word;
        select.setAttribute("aria-pressed", String(selected === word));
        if (!quiz && list.id !== "final") {
          select.append(document.createTextNode(word.slice(0, list.depth - 1)));
          const letter = node("strong", word[list.depth - 1] ?? " [end of word]", "comparison-letter");
          select.append(letter, document.createTextNode(word.slice(list.depth)));
          select.setAttribute("aria-label", `${select.getAttribute("aria-label")}. Comparing letter ${list.depth}: ${word[list.depth - 1] ?? "end of word"}.`);
        } else select.textContent = word;
        select.addEventListener("keydown", (event) => {
          const positions = { ArrowUp: Math.max(0, index - 1), ArrowDown: Math.min(list.words.length - 1, index + 1),
            Home: 0, End: list.words.length - 1 };
          if (locked || !Object.hasOwn(positions, event.key)) return;
          event.preventDefault();
          if (positions[event.key] !== index) {
            update(reorderWord(state, list.id, index, positions[event.key]), `${word} moved within ${list.name}.`, word);
          }
        });
        item.append(select);
        for (const [label, delta] of [["Up", -1], ["Down", 1]]) {
          const reorder = button(label, () =>
            update(reorderWord(state, list.id, index, index + delta), `${word} moved within ${list.name}.`, word),
          `Move ${word} ${label.toLowerCase()} in ${list.name}`);
          reorder.disabled = locked || index + delta < 0 || index + delta >= list.words.length;
          item.append(reorder);
        }
        words.append(item);
      });
      board.append(words);
      if (!list.words.length) board.append(node("p", "No words in this list yet."));
      boards.append(board);
    }
    const count = finalWords(state).length;
    container.dataset.finalCount = String(count);
  }

  render();
  return {
    lock() { locked = true; render(); },
    getState() { return state; },
  };
}

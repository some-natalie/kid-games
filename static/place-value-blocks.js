import {
  PLACES, PLACE_VALUES, adjustBlock, blockDescription, dropBlock, exchangeBlocks, representedNumber,
} from "./place-value-builders-engine.js";

const BLOCK_NAMES = { ones: "unit cube", tens: "ten rod", hundreds: "hundred flat", thousands: "thousand cube" };
const dimensions = { ones: [1, 1, 1], tens: [10, 1, 1], hundreds: [10, 10, 1], thousands: [10, 10, 10] };
let workspaceId = 0;

export function createBlockModel(place, documentRef = document) {
  if (!PLACES.includes(place)) throw new RangeError("Choose a base-ten block.");
  const [width, depth, height] = dimensions[place];
  const svg = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${6 * (width + depth) + 2} ${3 * (width + depth) + 7 * height + 2}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("base-ten-model", `base-ten-${place}`);
  const origin = depth * 6 + 1;
  for (const [face, columns, rows, transform] of [
    ["top", width, depth, `matrix(6 3 -6 3 ${origin} 1)`],
    ["front", width, height, `matrix(6 3 0 7 ${origin - depth * 6} ${1 + depth * 3})`],
    ["side", depth, height, `matrix(-6 3 0 7 ${origin + width * 6} ${1 + width * 3})`],
  ]) {
    const group = documentRef.createElementNS(svg.namespaceURI, "g");
    group.setAttribute("transform", transform);
    group.setAttribute("class", `base-ten-face base-ten-face-${face}`);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const square = documentRef.createElementNS(svg.namespaceURI, "rect");
        for (const [key, value] of Object.entries({ x, y, width: 1, height: 1 })) {
          square.setAttribute(key, String(value));
        }
        group.append(square);
      }
    }
    svg.append(group);
  }
  return svg;
}

export function drawBlockColumns(container, blocks, interactive = false, disabled = false) {
  container.replaceChildren();
  for (const place of PLACES) {
    const column = document.createElement("section");
    column.className = "place-value-column";
    column.dataset.drop = place;
    const heading = document.createElement("h3");
    heading.textContent = place[0].toUpperCase() + place.slice(1);
    const count = document.createElement("p");
    count.className = "place-value-count";
    count.textContent = `${blocks[place]} ${blocks[place] === 1 ? place.slice(0, -1) : place}`;
    const pieces = document.createElement("div");
    pieces.className = "place-value-pieces";
    for (let index = 0; index < Math.min(blocks[place], 100); index += 1) {
      const piece = document.createElement(interactive ? "button" : "span");
      piece.className = "base-ten-block";
      if (interactive) {
        piece.type = "button";
        piece.disabled = disabled;
        piece.dataset.source = "workspace";
        piece.dataset.place = place;
        piece.setAttribute("aria-label", `Remove one ${BLOCK_NAMES[place]}`);
      }
      piece.append(createBlockModel(place));
      pieces.append(piece);
    }
    if (blocks[place] > 100) {
      const more = document.createElement("p");
      more.className = "place-value-more";
      more.textContent = `${blocks[place] - 100} more ${place} (each removal takes one block).`;
      pieces.append(more);
    }
    column.append(heading, count, pieces);
    container.append(column);
  }
}

export function mountBlockWorkspace(container, { initial, onChange, readout, quiz = false }) {
  const controller = new AbortController();
  const listen = (type, handler) => container.addEventListener(type, handler, { signal: controller.signal });
  let blocks = initial;
  let disabled = false;
  let drag;
  let scrollFrame;
  let suppressClick = false;
  const id = `block-instructions-${++workspaceId}`;
  const instructions = document.createElement("p");
  instructions.id = id;
  instructions.textContent = "Drag a block from the tray to its matching place, or back to the tray to remove it. Drag near a screen edge to scroll. Drag workspace blocks to a neighboring place to exchange ten smaller blocks for one larger block, or one larger block for ten smaller blocks. You can also click or tap blocks, or use Tab and Enter; exchange buttons do the same trades.";
  const tray = document.createElement("div");
  tray.className = "base-ten-tray";
  tray.dataset.drop = "tray";
  tray.setAttribute("role", "group");
  tray.setAttribute("aria-label", "Block tray");
  const palette = new Map();
  for (const place of PLACES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "base-ten-supply";
    button.dataset.source = "tray";
    button.dataset.place = place;
    button.setAttribute("aria-label", `Add one ${BLOCK_NAMES[place]}`);
    button.setAttribute("aria-describedby", id);
    const label = document.createElement("span");
    label.textContent = `${BLOCK_NAMES[place]} (${PLACE_VALUES[place]})`;
    button.append(createBlockModel(place), label);
    tray.append(button);
    palette.set(place, button);
  }
  const columns = document.createElement("div");
  columns.className = "place-value-workspace";
  columns.setAttribute("role", "group");
  columns.setAttribute("aria-label", "Your base-ten blocks");
  const exchanges = document.createElement("div");
  exchanges.className = "place-value-controls-grid";
  const exchangeButtons = [];
  for (const lower of ["ones", "tens", "hundreds"]) {
    const higher = PLACES[PLACES.indexOf(lower) - 1];
    const row = document.createElement("div");
    row.className = "place-value-control-row";
    for (const direction of ["up", "down"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = direction === "up"
        ? `Exchange 10 ${lower} for one ${higher.slice(0, -1)}`
        : `Exchange 1 ${higher.slice(0, -1)} for 10 ${lower}`;
      button.dataset.exchange = lower;
      button.dataset.direction = direction;
      row.append(button);
      exchangeButtons.push({ button, lower, higher, direction });
    }
    exchanges.append(row);
  }
  const announcement = document.createElement("p");
  announcement.className = "block-announcement";
  announcement.setAttribute("role", "status");
  const counts = readout ?? document.createElement("p");
  counts.className = "place-value-readout";
  counts.setAttribute("role", "status");
  container.replaceChildren(instructions, tray, columns, exchanges, announcement);
  if (!readout) container.append(counts);

  function render() {
    drawBlockColumns(columns, blocks, true, disabled);
    counts.textContent = `${quiz ? "Your blocks" : `Number: ${representedNumber(blocks)}`}. ${blockDescription(blocks)}.`;
    for (const [place, button] of palette) {
      button.disabled = disabled || representedNumber(blocks) + PLACE_VALUES[place] > 9999;
    }
    for (const { button, lower, higher, direction } of exchangeButtons) {
      button.disabled = disabled || (direction === "up" ? blocks[lower] < 10 : blocks[higher] < 1);
    }
  }

  function commit(action, message, focus) {
    if (disabled) return;
    let next;
    try {
      next = action();
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      announcement.textContent = error.message;
      return;
    }
    if (!next) {
      announcement.textContent = "There are not enough blocks for that exchange.";
      return;
    }
    blocks = next;
    render();
    announcement.textContent = message;
    onChange(blocks);
    (focus?.disabled ? columns.querySelector("button:not(:disabled)") : focus)?.focus();
  }

  listen("click", (event) => {
    if (suppressClick || disabled) return;
    const source = event.target.closest("button[data-source]");
    const exchange = event.target.closest("button[data-exchange]");
    if (source) {
      const place = source.dataset.place;
      const amount = source.dataset.source === "tray" ? 1 : -1;
      commit(() => adjustBlock(blocks, place, amount),
        `${amount > 0 ? "Added" : "Removed"} one ${BLOCK_NAMES[place]}.`, palette.get(place));
    } else if (exchange) {
      commit(() => exchangeBlocks(blocks, exchange.dataset.exchange, exchange.dataset.direction),
        quiz ? "Blocks exchanged. You can revise them before submitting." : `${exchange.textContent}. The value stayed the same.`,
        exchange);
    }
  });

  function stopDrag() {
    if (!drag) return;
    const { pointerId, ghost } = drag;
    drag = undefined;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = undefined;
    ghost.remove();
    for (const target of container.querySelectorAll(".block-drop-active")) target.classList.remove("block-drop-active");
    if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
  }

  function scrollDrag() {
    scrollFrame = undefined;
    if (!drag?.moved) return;
    const direction = drag.clientY < 48 ? -1 : drag.clientY > innerHeight - 48 ? 1 : 0;
    if (direction) window.scrollBy(0, direction * 12);
    const target = document.elementFromPoint(drag.clientX, drag.clientY)?.closest("[data-drop]");
    for (const item of container.querySelectorAll("[data-drop]")) {
      item.classList.toggle("block-drop-active", item === target);
    }
    scrollFrame = requestAnimationFrame(scrollDrag);
  }

  listen("pointerdown", (event) => {
    const source = event.target.closest("button[data-source]");
    if (disabled || drag || !source || source.disabled || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    source.focus();
    const ghost = document.createElement("div");
    ghost.className = "base-ten-drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.append(createBlockModel(source.dataset.place));
    document.body.append(ghost);
    drag = { source: source.dataset.source, place: source.dataset.place, pointerId: event.pointerId,
      x: event.clientX, y: event.clientY, clientX: event.clientX, clientY: event.clientY, moved: false, ghost };
    ghost.hidden = true;
    container.setPointerCapture(event.pointerId);
  });
  listen("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8) drag.moved = true;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    if (drag.moved && scrollFrame === undefined) scrollFrame = requestAnimationFrame(scrollDrag);
    drag.ghost.hidden = !drag.moved;
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-drop]");
    for (const item of container.querySelectorAll("[data-drop]")) {
      item.classList.toggle("block-drop-active", item === target && drag.moved);
    }
  });
  listen("pointerup", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { moved, place, source } = drag;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-drop]");
    stopDrag();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (!moved) {
      const amount = source === "tray" ? 1 : -1;
      commit(() => adjustBlock(blocks, place, amount),
        `${amount > 0 ? "Added" : "Removed"} one ${BLOCK_NAMES[place]}.`, palette.get(place));
      return;
    }
    if (!target || !container.contains(target)) {
      announcement.textContent = "Drop a block in a place column or the block tray. Your blocks have not changed.";
      return;
    }
    commit(() => dropBlock(blocks, place, source, target.dataset.drop),
      quiz ? "Blocks moved. You can revise them before submitting." : "Blocks moved. Check your block counts.",
      palette.get(place));
  });
  listen("pointercancel", stopDrag);
  listen("lostpointercapture", stopDrag);
  render();
  return {
    setDisabled(value) {
      disabled = value;
      stopDrag();
      render();
    },
    destroy() {
      stopDrag();
      controller.abort();
      container.replaceChildren();
    },
  };
}

export function moveWord(words, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) ||
      from < 0 || to < 0 || from >= words.length || to >= words.length) {
    throw new RangeError("Word positions must be within the list.");
  }
  const result = [...words];
  const [word] = result.splice(from, 1);
  result.splice(to, 0, word);
  return result;
}

export function attachSorter(list, onMove) {
  let drag;
  let frame;

  function destination(y) {
    const others = [...list.children].filter((item) => item !== drag.item);
    const index = others.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    return index < 0 ? others.length : index;
  }

  function preview() {
    list.querySelectorAll(".drop-before, .drop-after").forEach((item) =>
      item.classList.remove("drop-before", "drop-after"),
    );
    const others = [...list.children].filter((item) => item !== drag.item);
    const target = destination(drag.y);
    if (target < others.length) others[target].classList.add("drop-before");
    else others.at(-1)?.classList.add("drop-after");
  }

  function animate() {
    if (!drag) return;
    if (drag.active) {
      const edge = 70;
      const speed = drag.y < edge ? -12 : drag.y > window.innerHeight - edge ? 12 : 0;
      if (speed) window.scrollBy(0, speed);
      preview();
    }
    frame = requestAnimationFrame(animate);
  }

  function cancel() {
    if (!drag) return;
    cancelAnimationFrame(frame);
    drag.ghost?.remove();
    drag.item.classList.remove("dragging");
    list.querySelectorAll(".drop-before, .drop-after").forEach((item) =>
      item.classList.remove("drop-before", "drop-after"),
    );
    const { button, pointerId } = drag;
    drag = undefined;
    if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
  }

  list.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".word-button");
    if (!button || button.disabled || drag || !event.isPrimary || event.button !== 0) return;
    const item = button.parentElement;
    drag = { button, item, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, from: [...list.children].indexOf(item), active: false };
    button.setPointerCapture(event.pointerId);
    button.focus();
    frame = requestAnimationFrame(animate);
  });
  list.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 6) {
      drag.active = true;
      drag.item.classList.add("dragging");
      const rect = drag.button.getBoundingClientRect();
      drag.ghost = drag.button.cloneNode(true);
      drag.ghost.classList.add("drag-ghost");
      drag.ghost.setAttribute("aria-hidden", "true");
      drag.ghost.tabIndex = -1;
      drag.ghost.style.width = `${rect.width}px`;
      document.body.append(drag.ghost);
    }
    if (drag.active) {
      event.preventDefault();
      drag.ghost.style.left = `${drag.x}px`;
      drag.ghost.style.top = `${drag.y}px`;
      preview();
    }
  });
  list.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { from, active } = drag;
    const rect = list.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    const to = destination(event.clientY);
    cancel();
    if (active && inside && from !== to) onMove(from, to);
  });
  list.addEventListener("pointercancel", cancel);
  list.addEventListener("lostpointercapture", cancel);
  window.addEventListener("blur", cancel);
  list.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancel();
      return;
    }
    const button = event.target.closest(".word-button");
    if (!button || button.disabled || drag) return;
    const from = [...list.children].indexOf(button.parentElement);
    const positions = { ArrowUp: Math.max(0, from - 1), ArrowDown: Math.min(list.children.length - 1, from + 1),
      Home: 0, End: list.children.length - 1 };
    if (Object.hasOwn(positions, event.key)) {
      event.preventDefault();
      if (from !== positions[event.key]) onMove(from, positions[event.key]);
    }
  });
  return cancel;
}

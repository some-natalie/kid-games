import {
  bridgeSummary, fractionAtTick, fractionName, positionLabel, stepTick, tickFromRatio,
} from "./fraction-bridge-engine.js";

let bridgeCount = 0;

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function tickText(tick, intervals) {
  if (tick === 0) return ["0", "zero"];
  if (tick === intervals) return ["1", "one"];
  const fraction = fractionAtTick(tick, intervals);
  return [fraction, fractionName(fraction)];
}

export function createTargetCard(fractions) {
  const card = node("p", "bridge-target");
  card.append(
    node("span", "bridge-target-label", "Walk Tilly to"),
    node("span", "bridge-target-fraction", fractions.join(" = ")),
    node("span", "bridge-target-name", fractions.map(fractionName).join(" = ")),
  );
  return card;
}

// Interactive number line: tap or drag snaps Tilly to a valid tick, arrows step
// between ticks, and the part from 0 to Tilly is shaded with a stripe pattern.
export function createBridgeLine({
  intervals, guides = true, interactive = true, selected, onMove, onChoose,
  keyboardHelp = "Use the arrow keys to move Tilly.",
}) {
  const id = `fraction-bridge-${bridgeCount += 1}`;
  const wrapper = node("div", "bridge-line");
  wrapper.dataset.rows = intervals > 4 ? "2" : "1";
  wrapper.dataset.facing = "forward";
  wrapper.style.setProperty("--intervals", String(intervals));
  const track = node("div", "bridge-track");
  const span = node("div", "bridge-span");
  const plank = node("div", "bridge-plank");
  const shade = node("div", "bridge-shade");
  const ticks = node("div", "bridge-ticks");
  const turtle = node("span", "bridge-turtle", "🐢");
  turtle.setAttribute("aria-hidden", "true");
  const labels = node("ol", "bridge-labels");
  labels.setAttribute("aria-hidden", "true");
  plank.append(shade, ticks);
  span.append(plank, turtle, labels);
  track.append(span);
  const summary = node("p", "bridge-summary");
  summary.id = `${id}-summary`;
  const summaryShort = node("span");
  summaryShort.setAttribute("aria-hidden", "true");
  const summaryFull = node("span", "visually-hidden");
  summary.append(summaryShort, summaryFull);
  const keys = node("p", "visually-hidden", keyboardHelp);
  keys.id = `${id}-keys`;
  wrapper.append(track, summary, keys);

  let tick = selected ?? 0;
  let chosen = selected !== undefined;
  let showGuides = guides;
  let disabled = !interactive;
  let dragging = false;

  if (interactive) {
    track.tabIndex = 0;
    track.setAttribute("role", "slider");
    track.setAttribute("aria-label", "Tilly's spot on the fraction bridge, from 0 to 1");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(intervals));
    track.setAttribute("aria-describedby", `${summary.id} ${keys.id}`);
  } else {
    track.setAttribute("aria-hidden", "true");
    summary.hidden = true;
  }

  function drawMarks() {
    const visible = Array.from({ length: intervals + 1 }, (_, index) => index)
      .filter((index) => showGuides || index === 0 || index === intervals);
    ticks.replaceChildren(...visible.map((index) => {
      const mark = node("span", `bridge-tick${index === 0 || index === intervals ? " end" : ""}`);
      mark.style.setProperty("--at", String(index / intervals));
      return mark;
    }));
    labels.replaceChildren(...visible.map((index) => {
      const [numeral, name] = tickText(index, intervals);
      const item = node("li", "bridge-label");
      item.dataset.tick = String(index);
      item.dataset.row = String(intervals > 4 ? index % 2 : 0);
      item.style.setProperty("--at", String(index / intervals));
      item.append(node("strong", undefined, numeral), node("span", undefined, name));
      return item;
    }));
  }

  function render() {
    const at = tick / intervals;
    wrapper.style.setProperty("--selected", String(chosen ? at : 0));
    wrapper.classList.toggle("has-choice", chosen);
    turtle.style.setProperty("--at", String(at));
    for (const item of labels.children) item.classList.toggle("selected", chosen && Number(item.dataset.tick) === tick);
    const where = positionLabel(tick, intervals);
    const parts = bridgeSummary(tick, intervals);
    summaryShort.textContent = chosen ? parts.short : "";
    summaryFull.textContent = chosen
      ? `Tilly is at ${where}. ${parts.text}`
      : "Tilly is waiting at 0. Tap or drag on the bridge to choose a spot.";
    if (interactive) {
      track.setAttribute("aria-valuenow", String(tick));
      track.setAttribute("aria-valuetext", chosen ? where : "No spot chosen yet; Tilly is at 0 (zero)");
    }
  }

  function moveTo(next) {
    const changed = next !== tick || !chosen;
    if (next !== tick) wrapper.dataset.facing = next > tick ? "forward" : "back";
    tick = next;
    chosen = true;
    render();
    if (changed) onMove?.(tick);
  }

  const isVertical = () => getComputedStyle(track).getPropertyValue("--bridge-vertical").trim() === "1";

  function updateOrientation() {
    if (interactive) track.setAttribute("aria-orientation", isVertical() ? "vertical" : "horizontal");
  }

  function tickFromPointer(event) {
    const bounds = plank.getBoundingClientRect();
    const ratio = isVertical()
      ? (bounds.bottom - event.clientY) / bounds.height
      : (event.clientX - bounds.left) / bounds.width;
    return tickFromRatio(ratio, intervals);
  }

  track.addEventListener("pointerdown", (event) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    dragging = true;
    track.setPointerCapture?.(event.pointerId);
    track.focus({ preventScroll: true });
    updateOrientation();
    wrapper.classList.add("dragging");
    moveTo(tickFromPointer(event));
  });
  track.addEventListener("pointermove", (event) => {
    if (dragging && !disabled) moveTo(tickFromPointer(event));
  });
  const stopDrag = (event, commit) => {
    if (!dragging) return;
    dragging = false;
    wrapper.classList.remove("dragging");
    if (track.hasPointerCapture?.(event.pointerId)) track.releasePointerCapture(event.pointerId);
    if (commit && !disabled) onChoose?.(tick);
  };
  track.addEventListener("pointerup", (event) => stopDrag(event, true));
  track.addEventListener("pointercancel", (event) => stopDrag(event, false));
  track.addEventListener("keydown", (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!chosen) moveTo(tick);
      onChoose?.(tick);
      return;
    }
    const next = stepTick(tick, event.key, intervals);
    if (next === undefined) return;
    event.preventDefault();
    moveTo(next);
  });

  drawMarks();
  render();
  if (interactive && typeof ResizeObserver === "function") new ResizeObserver(updateOrientation).observe(wrapper);
  return {
    element: wrapper,
    get tick() { return tick; },
    get chosen() { return chosen; },
    setGuides(value) {
      showGuides = value;
      drawMarks();
      render();
    },
    celebrate() {
      wrapper.classList.add("celebrating");
    },
    disable() {
      disabled = true;
      wrapper.classList.add("is-disabled");
      if (interactive) {
        track.setAttribute("aria-disabled", "true");
        track.tabIndex = -1;
      }
    },
  };
}

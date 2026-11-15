import { advanceTime, handAngles, timeFromHandPosition } from "./clockwork-critters-engine.js";

export const CLOCK_INSTRUCTIONS = "Click or tap and drag either hand to turn it. For keyboard control, Tab to a hand and use the arrow keys.";

const svgElement = (documentRef, name, attributes = {}) => {
  const element = documentRef.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [attribute, value] of Object.entries(attributes)) element.setAttribute(attribute, String(value));
  return element;
};

export function createClockFace(time, documentRef = document) {
  const { hour, minute } = handAngles(time);
  const face = svgElement(documentRef, "svg", {
    class: "clock-face",
    viewBox: "0 0 180 180",
    "aria-hidden": "true",
    focusable: "false",
  });
  face.append(svgElement(documentRef, "circle", { cx: 90, cy: 90, r: 82, class: "clock-dial" }));
  for (let number = 1; number <= 12; number += 1) {
    const angle = number * Math.PI / 6;
    const label = svgElement(documentRef, "text", {
      x: 90 + Math.sin(angle) * 62,
      y: 94 - Math.cos(angle) * 62,
      class: "clock-number",
    });
    label.textContent = String(number);
    face.append(label);
  }
  const hands = svgElement(documentRef, "g", { class: "clock-hands" });
  hands.append(svgElement(documentRef, "path", {
    d: "M90 96 L84 88 L86 47 L94 47 L96 88 Z",
    class: "clock-hand-hour",
    transform: `rotate(${hour} 90 90)`,
  }));
  hands.append(svgElement(documentRef, "line", {
    x1: 90, y1: 94, x2: 90, y2: 25,
    class: "clock-hand-minute",
    transform: `rotate(${minute} 90 90)`,
  }));
  hands.append(svgElement(documentRef, "circle", { cx: 90, cy: 90, r: 4, class: "clock-pivot" }));
  face.append(hands);
  return face;
}

export function createInteractiveClock(time, onChange, documentRef = document) {
  const face = createClockFace(time, documentRef);
  face.removeAttribute("aria-hidden");
  face.removeAttribute("focusable");
  face.setAttribute("role", "group");
  face.setAttribute("aria-label", "Set the clock");
  face.classList.add("clock-interactive");
  const sliders = {};
  let disabled = false;
  let drag = null;

  for (const hand of ["hour", "minute"]) {
    const drawing = face.querySelector(`.clock-hand-${hand}`);
    const slider = svgElement(documentRef, "g", {
      role: "slider", tabindex: 0,
      "aria-label": hand === "hour" ? "Hour hand" : "Minute hand",
      "aria-description": CLOCK_INSTRUCTIONS,
      "aria-valuemin": hand === "hour" ? 1 : 0,
      "aria-valuemax": hand === "hour" ? 12 : 55,
      class: "clock-hand-control",
      "data-hand": hand,
    });
    drawing.replaceWith(slider);
    drawing.removeAttribute("transform");
    slider.append(drawing, svgElement(documentRef, "line", {
      x1: 90, y1: hand === "hour" ? 74 : 30, x2: 90, y2: hand === "hour" ? 47 : 25,
      class: "clock-hand-hit",
    }));
    sliders[hand] = slider;
    slider.addEventListener("pointerdown", (event) => {
      if (disabled || drag || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      // Keep the short hand grabbable when the minute hand's line overlaps it.
      const hourGrip = hand === "minute" && event.target === drawing
        ? documentRef.elementsFromPoint(event.clientX, event.clientY).find((node) =>
          node.classList.contains("clock-hand-hit") && node.parentElement === sliders.hour)
        : null;
      const activeSlider = hourGrip ? sliders.hour : slider;
      activeSlider.focus();
      drag = { hand: activeSlider.dataset.hand, pointerId: event.pointerId };
      face.setPointerCapture(event.pointerId);
      activeSlider.classList.add("is-dragging");
    });
    slider.addEventListener("keydown", (event) => {
      const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (disabled || !direction) return;
      event.preventDefault();
      change(advanceTime(time, direction * (hand === "hour" ? 60 : 5)) % 720);
    });
  }

  function setTime(value) {
    time = value;
    const angles = handAngles(time);
    for (const hand of ["hour", "minute"]) {
      const value = hand === "hour" ? Math.floor(time / 60) % 12 || 12 : time % 60;
      sliders[hand].setAttribute("transform", `rotate(${angles[hand]} 90 90)`);
      sliders[hand].setAttribute("aria-valuenow", String(value));
      sliders[hand].setAttribute("aria-valuetext", hand === "hour"
        ? `${value} hours${time % 60 ? ` and ${time % 60} minutes` : ""}`
        : `${value} minutes past the hour`);
    }
  }

  function change(value) {
    if (value === time) return;
    setTime(value);
    onChange(value);
  }

  function move(event) {
    if (disabled || !drag || drag.pointerId !== event.pointerId) return;
    const point = face.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const position = point.matrixTransform(face.getScreenCTM().inverse());
    change(timeFromHandPosition(time, drag.hand, position.x - 90, position.y - 90));
  }

  function stopDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const { pointerId, hand } = drag;
    drag = null;
    sliders[hand].classList.remove("is-dragging");
    if (face.hasPointerCapture(pointerId)) face.releasePointerCapture(pointerId);
  }

  face.addEventListener("pointermove", move);
  face.addEventListener("pointerup", (event) => {
    if (drag?.pointerId !== event.pointerId) return;
    move(event);
    stopDrag();
  });
  face.addEventListener("pointercancel", stopDrag);
  face.addEventListener("lostpointercapture", stopDrag);
  setTime(time);
  return {
    face,
    setDisabled(value) {
      disabled = value;
      if (disabled) stopDrag();
      for (const slider of Object.values(sliders)) {
        slider.setAttribute("aria-disabled", String(disabled));
        slider.setAttribute("tabindex", disabled ? "-1" : "0");
      }
    },
  };
}

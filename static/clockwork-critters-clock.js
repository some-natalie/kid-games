import { handAngles } from "./clockwork-critters-engine.js";

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

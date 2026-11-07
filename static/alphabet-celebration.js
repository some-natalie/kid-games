export const MOTIONS = ["burst", "shower", "rise"];
export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ORIGINS = { shower: "top", rise: "bottom" };
const FALLBACK_COLORS = ["#ff5d8f", "#ffb627", "#3ccf91", "#3fa7f5", "#9b5de5", "#ff7a3d"];
export const DEFAULT_CELEBRATIONS = Object.freeze({
  messages: ["Fantastic!", "You did it!", "Wonderful work!"],
  effects: [
    { id: "confetti", label: "Confetti", motion: "burst", count: 90, symbols: [], colors: FALLBACK_COLORS },
    { id: "sparkles", label: "Sparkles", motion: "shower", count: 60, symbols: ["✦", "✧", "★", "✨"], colors: FALLBACK_COLORS },
  ],
});
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const between = (low, high) => low + Math.random() * (high - low);
const textList = (value, name, allowEmpty = false) => {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) ||
    value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new TypeError(`Celebration ${name} must be a list of text.`);
  }
  return value.map((item) => item.trim());
};

export function readCelebrations(data) {
  if (data?.version !== 1) throw new TypeError("Celebrations must use version 1.");
  const messages = textList(data.messages, "messages");
  if (!Array.isArray(data.effects) || data.effects.length === 0) throw new TypeError("Celebrations need effects.");
  const ids = new Set();
  const effects = data.effects.map((effect) => {
    if (typeof effect?.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(effect.id) || ids.has(effect.id)) {
      throw new TypeError("Each celebration effect needs a unique lowercase id.");
    }
    ids.add(effect.id);
    if (!MOTIONS.includes(effect.motion)) throw new TypeError(`Effect ${effect.id} has an unknown motion.`);
    if (!Number.isInteger(effect.count) || effect.count < 1 || effect.count > 150) {
      throw new TypeError(`Effect ${effect.id} needs a count from 1 to 150.`);
    }
    const symbols = textList(effect.symbols, `${effect.id} symbols`, true);
    const colors = textList(effect.colors, `${effect.id} colors`, true);
    if (!symbols.length && !colors.length) throw new TypeError(`Effect ${effect.id} needs symbols or colors.`);
    const label = typeof effect.label === "string" && effect.label.trim() ? effect.label.trim() : effect.id;
    return Object.freeze({ id: effect.id, label, motion: effect.motion, count: effect.count, symbols, colors });
  });
  return Object.freeze({ messages, effects });
}

let active;

function piece(layer, effect) {
  const element = document.createElement("span");
  if (effect.symbols.length) {
    element.className = "celebration-symbol";
    element.textContent = pick(effect.symbols);
    element.style.fontSize = `${between(1.2, 2.6)}rem`;
  } else {
    element.className = "confetti-piece";
  }
  if (effect.colors.length) {
    element.style.color = pick(effect.colors);
    if (!effect.symbols.length) element.style.background = element.style.color;
  }
  layer.append(element);
  return element;
}

function burst(layer, effect, origin) {
  const fromLeft = origin.endsWith("left");
  const fromTop = origin.startsWith("top");
  for (let index = 0; index < effect.count; index += 1) {
    const element = piece(layer, effect);
    element.style.left = fromLeft ? "0" : "100vw";
    element.style.top = fromTop ? "0" : "100vh";
    const dx = (fromLeft ? 1 : -1) * between(0.15, 0.85) * window.innerWidth;
    const rise = (fromTop ? 1 : -1) * between(0.15, 0.7) * window.innerHeight;
    const spin = between(360, 1080);
    element.animate([
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${rise}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.15}px, ${rise + window.innerHeight * 0.45}px) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: between(1800, 2700), delay: between(0, 250), easing: "cubic-bezier(.2,.7,.4,1)", fill: "both" });
  }
}

function drift(layer, effect, upward) {
  for (let index = 0; index < effect.count; index += 1) {
    const element = piece(layer, effect);
    element.style.left = `${between(2, 98)}vw`;
    element.style.top = upward ? "100vh" : "0";
    const sway = between(-8, 8);
    const [start, middle, end] = upward ?
      ["3rem", `-${between(30, 50)}vh`, `-${between(95, 115)}vh`] :
      ["-3rem", `${between(15, 35)}vh`, `${between(70, 105)}vh`];
    element.animate([
      { transform: `translate(0, ${start}) scale(0.5)`, opacity: 0 },
      { transform: `translate(${sway}vw, ${middle}) scale(1.1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${-sway}vw, ${end}) scale(0.7)`, opacity: 0 },
    ], { duration: between(1800, 2800), delay: between(0, 800), easing: upward ? "ease-out" : "ease-in", fill: "both" });
  }
}

function stillPieces(layer, effect) {
  const still = effect.symbols.length ? effect : { ...effect, symbols: ["✨"] };
  for (const [left, top] of [[12, 18], [82, 16], [20, 72], [76, 70], [50, 10]]) {
    const element = piece(layer, still);
    element.classList.add("still");
    element.style.left = `${left}vw`;
    element.style.top = `${top}vh`;
  }
}

export function stopCelebration() {
  if (!active) return;
  clearTimeout(active.timer);
  active.layer.remove();
  active = undefined;
}

export function celebrate(celebrations = DEFAULT_CELEBRATIONS) {
  stopCelebration();
  const effect = pick(celebrations.effects);
  const origin = ORIGINS[effect.motion] ?? pick(CORNERS);
  const layer = document.createElement("div");
  layer.className = "celebration";
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.effect = effect.id;
  layer.dataset.motion = effect.motion;
  layer.dataset.origin = origin;
  document.body.append(layer);
  const animate = typeof layer.animate === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate) stillPieces(layer, effect);
  else if (effect.motion === "burst") burst(layer, effect, origin);
  else drift(layer, effect, effect.motion === "rise");
  active = { layer, timer: setTimeout(stopCelebration, 4000) };
  return { message: pick(celebrations.messages), effect: effect.id, origin };
}

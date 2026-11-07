const MESSAGES = [
  "Fantastic!",
  "You did it!",
  "ABC superstar!",
  "Wonderful work!",
  "Amazing sorting!",
  "Hooray for you!",
];
const COLORS = ["#ff5d8f", "#ffb627", "#3ccf91", "#3fa7f5", "#9b5de5", "#ff7a3d"];
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const between = (low, high) => low + Math.random() * (high - low);

let active;

function confetti(layer, origin) {
  const fromLeft = origin.endsWith("left");
  const fromTop = origin.startsWith("top");
  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.background = pick(COLORS);
    piece.style.left = fromLeft ? "0" : "100vw";
    piece.style.top = fromTop ? "0" : "100vh";
    layer.append(piece);
    const dx = (fromLeft ? 1 : -1) * between(0.15, 0.85) * window.innerWidth;
    const rise = (fromTop ? 1 : -1) * between(0.15, 0.7) * window.innerHeight;
    const spin = between(360, 1080);
    piece.animate([
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px, ${rise}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.15}px, ${rise + window.innerHeight * 0.45}px) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: between(1800, 2700), delay: between(0, 250), easing: "cubic-bezier(.2,.7,.4,1)", fill: "both" });
  }
}

function sparkles(layer) {
  for (let index = 0; index < 60; index += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.textContent = pick(["✦", "✧", "★", "✨"]);
    sparkle.style.color = pick(COLORS);
    sparkle.style.left = `${between(2, 98)}vw`;
    sparkle.style.fontSize = `${between(1, 2.4)}rem`;
    layer.append(sparkle);
    sparkle.animate([
      { transform: "translateY(-3rem) scale(0.4)", opacity: 0 },
      { transform: `translateY(${between(15, 35)}vh) scale(1.2)`, opacity: 1, offset: 0.3 },
      { transform: `translateY(${between(70, 105)}vh) scale(0.6)`, opacity: 0 },
    ], { duration: between(1600, 2600), delay: between(0, 900), easing: "ease-in", fill: "both" });
  }
}

function stillSparkles(layer) {
  for (const [left, top] of [[12, 18], [82, 16], [20, 72], [76, 70], [50, 10]]) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle still";
    sparkle.textContent = "✨";
    sparkle.style.left = `${left}vw`;
    sparkle.style.top = `${top}vh`;
    layer.append(sparkle);
  }
}

export function stopCelebration() {
  if (!active) return;
  clearTimeout(active.timer);
  active.layer.remove();
  active = undefined;
}

export function celebrate() {
  stopCelebration();
  const effect = Math.random() < 0.5 ? "confetti" : "sparkles";
  const origin = effect === "confetti" ? pick(CORNERS) : "top";
  const layer = document.createElement("div");
  layer.className = "celebration";
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.effect = effect;
  layer.dataset.origin = origin;
  document.body.append(layer);
  const animate = typeof layer.animate === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate) stillSparkles(layer);
  else if (effect === "confetti") confetti(layer, origin);
  else sparkles(layer);
  active = { layer, timer: setTimeout(stopCelebration, 3800) };
  return { message: pick(MESSAGES), effect, origin };
}

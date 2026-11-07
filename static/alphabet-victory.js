export const VICTORY_SCENES = Object.freeze([
  "dinosaur", "robot", "rocket", "butterflies", "ocean",
  "rainbow", "balloons", "flowers", "stars", "penguins",
]);

export function pickVictory(random = Math.random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Victory randomness must be a number from 0 up to, but not including, 1.");
  }
  return VICTORY_SCENES[Math.floor(value * VICTORY_SCENES.length)];
}

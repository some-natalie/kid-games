export const LEVELS = Object.freeze([
  { title: "Little collections", steps: 2, max: 10, operations: ["+", "+"] },
  { title: "Share with a friend", steps: 2, max: 10, operations: ["+", "-"] },
  { title: "Gather after sharing", steps: 2, max: 20, operations: ["-", "+"] },
  { title: "A bigger basket", steps: 2, max: 20, operations: ["+", "-"] },
  { title: "Three woodland stops", steps: 3, max: 20, operations: ["+", "-", "+"] },
  { title: "Helping the neighbors", steps: 3, max: 30, operations: ["-", "+", "-"] },
  { title: "The hazelnut grove", steps: 3, max: 50, operations: ["+", "-", "+"] },
  { title: "Four forest friends", steps: 4, max: 50, operations: ["-", "+", "-", "+"] },
  { title: "Winter supplies", steps: 4, max: 100, operations: ["+", "-", "+", "-"] },
  { title: "Home to the hollow", steps: 4, max: 100, operations: ["+", "-", "+", "-"] },
].map((level) => Object.freeze({ ...level, operations: Object.freeze(level.operations) })));

function pickIndex(length, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random values must be between 0 (inclusive) and 1 (exclusive).");
  }
  return Math.floor(value * length);
}

export function buildJourney(levelIndex, random = Math.random) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) {
    throw new RangeError("Choose an existing Acorn Adventure level.");
  }
  const level = LEVELS[levelIndex];
  // Leave room to collect or share at every stop, without negative totals.
  const reserve = level.operations[0] === "+" && level.operations[1] === "+" ? 2 : 1;
  const start = 1 + pickIndex(level.max - reserve, random);
  let total = start;
  const steps = level.operations.map((operation, index) => {
    const following = level.operations[index + 1];
    const limit = operation === "+"
      ? level.max - total - (following === "+" ? 1 : 0)
      : total - (following === "-" ? 1 : 0);
    const amount = 1 + pickIndex(limit, random);
    const before = total;
    total = operation === "+" ? total + amount : total - amount;
    const others = Array.from({ length: level.max + 1 }, (_, value) => value)
      .filter((value) => value !== total)
      .sort((a, b) => Math.abs(a - total) - Math.abs(b - total));
    const choices = [total, ...others.slice(0, 3)];
    for (let position = choices.length - 1; position > 0; position -= 1) {
      const swap = pickIndex(position + 1, random);
      [choices[position], choices[swap]] = [choices[swap], choices[position]];
    }
    return { operation, amount, before, total, choices };
  });
  return { start, steps, total };
}

export function stepEquation(step) {
  return `${step.before} ${step.operation === "+" ? "+" : "\u2212"} ${step.amount} = ${step.total}`;
}

export function stepStory(step) {
  return step.operation === "+"
    ? `Find ${step.amount} more nuts. Add them to your ${step.before}.`
    : `Share ${step.amount} nuts with a friend. Take them away from your ${step.before}.`;
}

export function stepHint(step) {
  return `Start with ${step.before}. Count ${step.operation === "+" ? "forward" : "back"} ${step.amount}. Carry this new total to the next stop.`;
}

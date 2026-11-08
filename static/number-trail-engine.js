export const STEPS_PER_LEVEL = 5;
export const LEVELS = Object.freeze([
  { title: "Meadow gate", operations: ["+"], max: 10, unit: 1, missing: false },
  { title: "Bunny bridge", operations: ["-"], max: 10, unit: 1, missing: false },
  { title: "Butterfly bend", operations: ["+"], max: 20, unit: 1, missing: false },
  { title: "Pebble pond", operations: ["-"], max: 20, unit: 1, missing: false },
  { title: "Hidden acorns", operations: ["+"], max: 20, unit: 1, missing: true },
  { title: "Fox footprints", operations: ["-"], max: 20, unit: 1, missing: true },
  { title: "Tall-tree trail", operations: ["+"], max: 100, unit: 10, missing: false },
  { title: "Owl lookout", operations: ["-"], max: 100, unit: 10, missing: false },
  { title: "Forest fork", operations: ["+", "-"], max: 100, unit: 1, missing: false },
  { title: "Home sweet home", operations: ["+", "-"], max: 100, unit: 1, missing: true },
].map((level) => Object.freeze({ ...level, operations: Object.freeze(level.operations) })));

function randomIndex(length, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random values must be between 0 (inclusive) and 1 (exclusive).");
  }
  return Math.floor(value * length);
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1, random);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function buildRound(levelIndex, random = Math.random) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) {
    throw new RangeError("Choose an existing Number Trail level.");
  }
  const level = LEVELS[levelIndex];
  const pools = new Map(level.operations.map((operation) => {
    const problems = [];
    for (let left = level.unit; left <= level.max; left += level.unit) {
      for (let right = level.unit; right <= level.max; right += level.unit) {
        const result = operation === "+" ? left + right : left - right;
        if (result >= 0 && result <= level.max) problems.push({ left, right, operation, result });
      }
    }
    return [operation, shuffle(problems, random)];
  }));
  return Array.from({ length: STEPS_PER_LEVEL }, (_, index) => {
    const operation = level.operations[index % level.operations.length];
    const problem = pools.get(operation).pop();
    const missing = level.missing
      ? (Math.floor(index / level.operations.length) % 2 === 0 ? "left" : "right") : "result";
    const answer = problem[missing];
    const distractors = Array.from({ length: level.max / level.unit + 1 }, (_, value) => value * level.unit)
      .filter((value) => value !== answer)
      .sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
    const choices = shuffle([answer, ...distractors.slice(0, 3)], random);
    return { ...problem, missing, answer, choices };
  });
}

export function equationText(problem, solved = false) {
  const part = (name) => !solved && problem.missing === name ? "?" : problem[name];
  return `${part("left")} ${problem.operation === "+" ? "+" : "\u2212"} ${part("right")} = ${part("result")}`;
}

export function spokenEquation(problem) {
  const part = (name) => problem.missing === name ? "what number" : problem[name];
  return `${part("left")} ${problem.operation === "+" ? "plus" : "minus"} ${part("right")} equals ${part("result")}?`;
}

export function hintText(problem) {
  if (problem.missing === "result") {
    const direction = problem.operation === "+" ? "forward" : "back";
    const jumps = problem.left % 10 === 0 && problem.right % 10 === 0
      ? ` Try ${problem.right / 10} jumps of 10.` : "";
    return `Start at ${problem.left} and count ${direction} ${problem.right}.${jumps} You can use paper or your fingers.`;
  }
  if (problem.operation === "+") {
    const known = problem.missing === "left" ? problem.right : problem.left;
    return `How many more do you need to go from ${known} to ${problem.result}?`;
  }
  return problem.missing === "left"
    ? `What starting number leaves ${problem.result} after taking away ${problem.right}? Try adding them.`
    : `How many do you take away from ${problem.left} to leave ${problem.result}?`;
}

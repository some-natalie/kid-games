export const MODES = Object.freeze({
  practice: Object.freeze({ label: "Untimed practice", duration: null }),
  gentle: Object.freeze({ label: "Gentle patrol", duration: 18000 }),
  challenge: Object.freeze({ label: "Challenge patrol", duration: 12000 }),
});

export const OPERATIONS = Object.freeze({
  addition: Object.freeze({ symbol: "+", label: "addition" }),
  subtraction: Object.freeze({ symbol: "−", label: "subtraction" }),
  multiplication: Object.freeze({ symbol: "×", label: "multiplication" }),
});

function randomIndex(length, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random values must be between 0 (inclusive) and 1 (exclusive).");
  }
  return Math.floor(value * length);
}

export function maxForWave(wave) {
  if (!Number.isInteger(wave) || wave < 1) throw new RangeError("Wave must be a positive whole number.");
  return Math.min(20, 10 + Math.floor((wave - 1) / 2));
}

export function travelDuration(mode, wave) {
  const settings = MODES[mode];
  if (!settings) throw new RangeError("Choose a Math Meteor Patrol mode.");
  if (mode === "practice") return null;
  if (!Number.isInteger(wave) || wave < 1) throw new RangeError("Wave must be a positive whole number.");
  const change = Math.min(wave - 1, 12);
  return mode === "gentle"
    ? settings.duration - change * 350
    : settings.duration - change * 250;
}

export function progressForElapsed(elapsed, duration) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("Elapsed time must be nonnegative and duration must be positive.");
  }
  return Math.min(1, elapsed / duration);
}

export function buildProblem(operation, max, random = Math.random) {
  if (!Object.hasOwn(OPERATIONS, operation)) throw new RangeError("Choose an arithmetic target.");
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new RangeError("Number limit must be from 1 to 20.");
  const pairs = [];
  for (let left = operation === "multiplication" ? 1 : 0; left <= max; left += 1) {
    for (let right = operation === "multiplication" ? 1 : 0; right <= max; right += 1) {
      const answer = operation === "addition" ? left + right
        : operation === "subtraction" ? left - right : left * right;
      if (answer >= 0 && answer <= max) pairs.push({ left, right, answer });
    }
  }
  const { left, right, answer } = pairs[randomIndex(pairs.length, random)];
  return { operation, left, right, answer, max };
}

export function equationText(problem) {
  return `${problem.left} ${OPERATIONS[problem.operation].symbol} ${problem.right} = ${problem.answer}`;
}

export function strategyText(problem) {
  if (problem.operation === "addition") {
    return `Start at ${problem.left} and count on ${problem.right}.`;
  }
  if (problem.operation === "subtraction") {
    return `Start at ${problem.left} and count back ${problem.right}.`;
  }
  return `Think of ${problem.left} groups of ${problem.right}. Count the groups to find the total.`;
}

export function buildQuizQuestions(operation, random = Math.random) {
  return Array.from({ length: 11 }, (_, index) => {
    const wave = index * 2 + 1;
    const problem = buildProblem(operation, maxForWave(wave), random);
    return {
      kind: "math-meteor",
      title: `Question ${index + 1}`,
      prompt: `${problem.left} ${OPERATIONS[operation].symbol} ${problem.right} = ?`,
      expected: problem.answer,
      correction: `Correct equation: ${equationText(problem)}. ${strategyText(problem)}`,
      problem,
    };
  });
}

export const PUZZLES_PER_LEVEL = 4;

export const LEVELS = Object.freeze([
  { title: "Fair picnic shares", activity: "equal" },
  { title: "Name the serving", activity: "name" },
  { title: "Build halves and quarters", activity: "build" },
  { title: "Try thirds, sixths, and eighths", activity: "build" },
  { title: "Compare same-size servings", activity: "compare" },
  { title: "Match the same coverage", activity: "equivalent" },
  { title: "Finish the whole picnic", activity: "complete" },
].map((level) => Object.freeze(level)));

function assertFraction(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) ||
      denominator < 1 || numerator < 0 || numerator > denominator) {
    throw new RangeError("Fractions need whole-number parts and a positive denominator.");
  }
}

export function compareFractions(numeratorA, denominatorA, numeratorB, denominatorB) {
  assertFraction(numeratorA, denominatorA);
  assertFraction(numeratorB, denominatorB);
  const left = BigInt(numeratorA) * BigInt(denominatorB);
  const right = BigInt(numeratorB) * BigInt(denominatorA);
  return left > right ? 1 : left < right ? -1 : 0;
}

export function equivalentFractions(numeratorA, denominatorA, numeratorB, denominatorB) {
  return compareFractions(numeratorA, denominatorA, numeratorB, denominatorB) === 0;
}

export function equalShares(areas) {
  return Array.isArray(areas) && areas.length > 0 &&
    areas.every((area) => Number.isInteger(area) && area > 0 && area === areas[0]);
}

export function fractionName(numerator, denominator) {
  assertFraction(numerator, denominator);
  const names = { 2: "half", 3: "third", 4: "quarter", 6: "sixth", 8: "eighth" };
  const numerators = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  if (numerator === denominator) return "one whole";
  const part = names[denominator] ?? `${denominator}th`;
  const count = numerators[numerator] ?? String(numerator);
  return `${count} ${numerator === 1 ? part : `${part}s`}`;
}

export function fractionText(numerator, denominator) {
  return `${fractionName(numerator, denominator)} (${numerator}/${denominator})`;
}

export function buildPuzzle(levelIndex, puzzleIndex = 0) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= LEVELS.length) {
    throw new RangeError("Choose an existing Picnic Pizza level.");
  }
  if (!Number.isInteger(puzzleIndex) || puzzleIndex < 0) {
    throw new RangeError("Puzzle number must be a non-negative whole number.");
  }

  const level = LEVELS[levelIndex];
  const turn = puzzleIndex % PUZZLES_PER_LEVEL;
  const shape = level.activity === "complete" ? "rectangle" : turn % 2 === 0 ? "circle" : "rectangle";
  const food = shape === "circle" ? "Pizza"
    : level.activity === "complete" || levelIndex === 3 ? "Fruit bar" : "Rectangular sandwich";
  const puzzle = { levelIndex, title: level.title, activity: level.activity, shape, food };

  if (level.activity === "equal") {
    const areas = turn % 2 === 0 ? [1, 1] : [1, 3];
    return {
      ...puzzle,
      prompt: "Are these parts equal shares of the whole?",
      visual: { areas, denominator: areas.length, selected: [] },
      expected: equalShares(areas) ? "equal" : "unequal",
      choices: ["equal", "unequal"],
    };
  }

  if (level.activity === "name") {
    const denominator = turn % 2 === 0 ? 2 : 4;
    const numerator = turn % 2 === 0 ? 1 : 3;
    const choices = Array.from({ length: denominator }, (_, index) => `${index + 1}/${denominator}`);
    return {
      ...puzzle,
      prompt: "What fraction of the same-size whole is selected?",
      visual: { areas: Array(denominator).fill(1), denominator, selected: Array.from({ length: numerator }, (_, i) => i) },
      numerator,
      denominator,
      expected: `${numerator}/${denominator}`,
      choices,
    };
  }

  if (level.activity === "build") {
    const denominator = levelIndex === 2 ? 4 : [3, 6, 8][turn % 3];
    const numerator = levelIndex === 2 ? [1, 2, 3][turn % 3] : denominator - 1;
    return {
      ...puzzle,
      prompt: `Select ${fractionText(numerator, denominator)} to serve.`,
      visual: { areas: Array(denominator).fill(1), denominator, selected: [] },
      numerator,
      denominator,
      expected: numerator,
    };
  }

  if (level.activity === "compare") {
    const pairs = [
      [{ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 }],
      [{ numerator: 2, denominator: 3 }, { numerator: 3, denominator: 6 }],
      [{ numerator: 3, denominator: 8 }, { numerator: 1, denominator: 4 }],
      [{ numerator: 3, denominator: 4 }, { numerator: 2, denominator: 3 }],
    ];
    const [a, b] = pairs[turn];
    return {
      ...puzzle,
      prompt: "Both pictures show the same-size whole. Which serving covers more?",
      comparison: [a, b],
      expected: compareFractions(a.numerator, a.denominator, b.numerator, b.denominator) > 0 ? "A" : "B",
      choices: ["A", "B"],
    };
  }

  if (level.activity === "equivalent") {
    const choices = ["2/4", "4/8", "3/4"];
    return {
      ...puzzle,
      prompt: "Tap every fraction that covers the same amount as one half (1/2).",
      target: { numerator: 1, denominator: 2 },
      choices,
      expected: choices.filter((choice) => {
        const [numerator, denominator] = choice.split("/").map(Number);
        return equivalentFractions(1, 2, numerator, denominator);
      }),
    };
  }

  const denominator = 4;
  const numerator = 3;
  return {
    ...puzzle,
    prompt: "Three of four equal pieces are served. Select the piece that completes this same whole.",
    visual: {
      areas: Array(denominator).fill(1),
      denominator,
      selected: [0, 1, 2],
    },
    numerator,
    denominator,
    expected: [3],
  };
}

export function matchesAnswer(puzzle, response) {
  if (puzzle.activity === "build") {
    return Array.isArray(response) &&
      new Set(response).size === response.length &&
      response.every((piece) => Number.isInteger(piece) && piece >= 0 && piece < puzzle.denominator) &&
      response.length === puzzle.expected;
  }
  if (puzzle.activity === "complete") {
    if (!Array.isArray(response) || new Set(response).size !== response.length) return false;
    const pieces = new Set([...puzzle.visual.selected, ...response]);
    return response.every((piece) => Number.isInteger(piece) && piece >= 0 && piece < puzzle.denominator &&
      !puzzle.visual.selected.includes(piece)) &&
      pieces.size === puzzle.denominator;
  }
  if (Array.isArray(puzzle.expected)) {
    return Array.isArray(response) && response.length === puzzle.expected.length &&
      new Set(response).size === response.length &&
      puzzle.expected.every((answer) => response.includes(answer));
  }
  return response === puzzle.expected;
}

export function hintText(puzzle) {
  if (puzzle.activity === "equal") {
    return "Equal shares have the same area. Compare how much space each piece takes, not just how many pieces there are.";
  }
  if (puzzle.activity === "name") {
    return `The denominator, ${puzzle.denominator}, tells how many equal pieces make the whole. The numerator tells how many pieces are selected.`;
  }
  if (puzzle.activity === "build") {
    return `Choose ${puzzle.numerator} of the ${puzzle.denominator} equal pieces. The bottom number counts all the pieces; the top number counts the ones you serve.`;
  }
  if (puzzle.activity === "compare") {
    return "The whole pizzas are the same size. Look at how much of each whole is covered; the number of pieces alone does not tell which serving is larger.";
  }
  if (puzzle.activity === "equivalent") {
    return "Compare the covered area on equal-size wholes. Different numbers of pieces can cover exactly the same amount.";
  }
  return "Look at the three pieces already served and find the one remaining piece that fills the gap.";
}

export function quizQuestions() {
  const puzzleFor = (level, turn = 0) => buildPuzzle(level, turn);
  const questions = [
    puzzleFor(0, 0),
    puzzleFor(1, 1),
    puzzleFor(2, 2),
    puzzleFor(3, 2),
    puzzleFor(4, 0),
    puzzleFor(5, 0),
    puzzleFor(6, 0),
  ];
  return questions.map((puzzle, index) => {
    const choices = puzzle.activity === "build"
      ? Array.from({ length: puzzle.denominator }, (_, piece) => String(piece + 1))
      : puzzle.activity === "complete" ? ["1", "2", "3"] : puzzle.choices;
    const expected = puzzle.activity === "build" ? String(puzzle.expected)
      : puzzle.activity === "complete" ? "1" : puzzle.expected;
    const prompt = puzzle.activity === "build"
      ? `How many of ${puzzle.denominator} equal pieces make the selected serving?`
      : puzzle.activity === "complete"
        ? "Three of four equal pieces are served. How many more pieces fill the same whole?"
        : puzzle.prompt;
    const visualDescription = puzzle.activity === "compare"
      ? `Same-size whole A: ${puzzle.comparison[0].numerator}/${puzzle.comparison[0].denominator}; ` +
        `same-size whole B: ${puzzle.comparison[1].numerator}/${puzzle.comparison[1].denominator}.`
      : puzzle.activity === "equivalent"
        ? "Compare each fraction's coverage of a same-size whole."
        : puzzle.activity === "name"
          ? `${puzzle.numerator} of ${puzzle.denominator} equal pieces are selected.`
          : puzzle.activity === "equal"
            ? `Piece areas: ${puzzle.visual.areas.join(" and ")} equal area unit${puzzle.visual.areas.some((area) => area !== 1) ? "s" : ""}.`
            : `${puzzle.denominator} equal pieces make one whole.`;
    const correction = puzzle.activity === "equal"
      ? "Equal shares have the same area."
      : puzzle.activity === "compare"
        ? `The larger serving is ${puzzle.expected}: ` +
          `${puzzle.comparison[puzzle.expected === "A" ? 0 : 1].numerator}/` +
          `${puzzle.comparison[puzzle.expected === "A" ? 0 : 1].denominator}.`
        : puzzle.activity === "equivalent"
          ? "One half, two fourths, and four eighths cover the same amount."
          : puzzle.activity === "name"
            ? `${puzzle.numerator} selected piece of ${puzzle.denominator} equal pieces is ${fractionText(puzzle.numerator, puzzle.denominator)}.`
            : puzzle.activity === "complete"
              ? "One more equal piece fills the whole."
              : `${puzzle.expected} of ${puzzle.denominator} equal pieces make the serving.`;
    return {
      kind: "pizza",
      title: `Level ${puzzle.levelIndex + 1}, question ${index + 1}: ${puzzle.title}`,
      prompt,
      visualDescription,
      choices,
      expected,
      multiple: Array.isArray(expected),
      correction,
    };
  });
}

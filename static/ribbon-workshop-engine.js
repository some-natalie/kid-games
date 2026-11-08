export const PARTITIONS = Object.freeze([2, 3, 4, 6, 8]);

const target = (numerator, denominator) => Object.freeze({ numerator, denominator });
const oneRibbon = (denominator) => Object.freeze([{ denominator }]);
const twoRibbons = (firstDenominator, secondDenominator) => Object.freeze([
  { denominator: firstDenominator },
  { denominator: secondDenominator },
]);

export const LEVELS = Object.freeze([
  { title: "Fold a half", type: "select", target: target(1, 2), ribbons: oneRibbon(2),
    instructions: "Fold the ribbon into equal parts, then select half of its length.",
    hint: "A half is one of two equal parts. The fold marks keep every part the same size." },
  { title: "Find one quarter", type: "select", target: target(1, 4), ribbons: oneRibbon(4),
    instructions: "Fold the ribbon into equal parts and select one quarter.",
    hint: "A quarter is one of four equal parts. Count the selected parts out of all the parts." },
  { title: "Color three quarters", type: "select", target: target(3, 4), ribbons: oneRibbon(4),
    instructions: "Select three of four equal parts to show three quarters.",
    hint: "The top number tells how many parts to select. The bottom number tells how many equal parts make the whole." },
  { title: "Make two thirds", type: "select", target: target(2, 3), ribbons: oneRibbon(3),
    instructions: "Fold the ribbon into thirds and select two equal parts.",
    hint: "Thirds are made by splitting the same whole into three equal lengths." },
  { title: "Match halves and quarters", type: "equivalent", target: target(1, 2), ribbons: twoRibbons(2, 4),
    instructions: "Select the same length on both ribbons. Show why one half matches two quarters.",
    hint: "Both ribbons are the same whole length. Compare their selected starts and ends." },
  { title: "Match halves and eighths", type: "equivalent", target: target(1, 2), ribbons: twoRibbons(2, 8),
    instructions: "Select equal lengths on the two ribbons. How many eighths make one half?",
    hint: "The eighths are smaller, so you need more of them to cover the same length." },
  { title: "Match thirds and sixths", type: "equivalent", target: target(1, 3), ribbons: twoRibbons(3, 6),
    instructions: "Align the same whole and show that one third has the length of two sixths.",
    hint: "The whole has the same length on both ribbons. Count how many sixths fit across one third." },
  { title: "Compare two lengths", type: "compare", target: target(3, 4), other: target(2, 3),
    ribbons: twoRibbons(4, 3),
    instructions: "Select three quarters on the first ribbon and two thirds on the second. Which length is longer?",
    hint: "Compare the ends of the selected lengths from the shared left edge. You can also compare 3 × 3 with 2 × 4." },
  { title: "Complete the whole", type: "complete", target: target(5, 8), ribbons: twoRibbons(8, 8),
    instructions: "The first ribbon has five eighths selected. Select the missing part on the second ribbon to complete a whole.",
    hint: "A whole is eight eighths. Count how many eighths are not yet covered, and select those parts after the five already shown." },
].map((level) => Object.freeze(level)));

function assertFraction(value) {
  if (!value || !Number.isSafeInteger(value.numerator) || value.numerator < 0 ||
      !Number.isSafeInteger(value.denominator) || value.denominator <= 0) {
    throw new RangeError("Fractions need a non-negative whole-number numerator and a positive whole-number denominator.");
  }
}

export function fraction(numerator, denominator) {
  const value = { numerator, denominator };
  assertFraction(value);
  return value;
}

export function compareFractions(left, right) {
  assertFraction(left);
  assertFraction(right);
  const leftProduct = BigInt(left.numerator) * BigInt(right.denominator);
  const rightProduct = BigInt(right.numerator) * BigInt(left.denominator);
  return leftProduct < rightProduct ? -1 : leftProduct > rightProduct ? 1 : 0;
}

export function fractionsEquivalent(left, right) {
  return compareFractions(left, right) === 0;
}

export function fractionLabel(value) {
  assertFraction(value);
  return `${value.numerator}/${value.denominator}`;
}

export function fractionDescription(value) {
  assertFraction(value);
  return `${fractionLabel(value)} (${value.numerator} of ${value.denominator} equal parts)`;
}

export function partitionRibbon(denominator) {
  if (!PARTITIONS.includes(denominator)) throw new RangeError("Choose a supported equal ribbon partition.");
  return Array.from({ length: denominator }, (_, index) => Object.freeze({ index, start: index, end: index + 1 }));
}

function readSelection(selection) {
  if (!selection || !PARTITIONS.includes(selection.denominator) || !Array.isArray(selection.selected)) return null;
  const indices = selection.selected;
  if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= selection.denominator) ||
      new Set(indices).size !== indices.length) return null;
  return fraction(indices.length, selection.denominator);
}

function isPrefix(selection) {
  return selection.selected.every((index, position) => index === position);
}

function equalsIndices(selection, indices) {
  return indices.length === selection.selected.length &&
    indices.every((index) => selection.selected.includes(index));
}

export function checkExercise(levelIndex, selections) {
  const level = LEVELS[levelIndex];
  if (!level || !Array.isArray(selections) || selections.length !== level.ribbons.length) return false;
  const values = selections.map(readSelection);
  if (values.some((value) => value === null)) return false;

  if (level.type === "select") {
    return isPrefix(selections[0]) && fractionsEquivalent(values[0], level.target);
  }
  if (level.type === "equivalent") {
    return selections.every(isPrefix) && values.every((value) => fractionsEquivalent(value, level.target));
  }
  if (level.type === "compare") {
    return selections.every(isPrefix) &&
      fractionsEquivalent(values[0], level.target) &&
      fractionsEquivalent(values[1], level.other) &&
      compareFractions(values[0], values[1]) === compareFractions(level.target, level.other);
  }
  const knownParts = level.target.numerator;
  const known = selections[0];
  const missing = selections[1];
  const needed = Array.from({ length: level.target.denominator - knownParts }, (_, index) => knownParts + index);
  const sumNumerator = BigInt(values[0].numerator) * BigInt(values[1].denominator) +
    BigInt(values[1].numerator) * BigInt(values[0].denominator);
  const sumDenominator = BigInt(values[0].denominator) * BigInt(values[1].denominator);
  return known.denominator === level.target.denominator &&
    known.selected.length === knownParts && isPrefix(known) &&
    missing.denominator === level.target.denominator &&
    equalsIndices(missing, needed) &&
    sumNumerator === sumDenominator;
}

function selectionChoices(denominator) {
  return Array.from({ length: denominator + 1 }, (_, numerator) => ({
    value: numerator,
    label: `${numerator} of ${denominator} equal parts`,
  }));
}

export function makeQuizQuestion(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) throw new RangeError("Choose an existing Ribbon Workshop level.");
  const title = `Level ${levelIndex + 1}: ${level.title}`;
  if (level.type === "select") {
    return { kind: "ribbon", title, prompt: `Select ${fractionLabel(level.target)} on a ribbon divided into ${level.target.denominator} equal parts.`,
      expected: level.target.numerator, choices: selectionChoices(level.target.denominator),
      correction: `Select ${fractionLabel(level.target)}: ${level.target.numerator} of ${level.target.denominator} equal parts.` };
  }
  if (level.type === "equivalent") {
    const denominator = level.ribbons[1].denominator;
    const numerator = level.target.numerator * denominator / level.target.denominator;
    return { kind: "ribbon", title, prompt: `The first ribbon shows ${fractionLabel(level.target)}. How many of ${denominator} equal parts have the same length?`,
      expected: numerator, choices: selectionChoices(denominator),
      correction: `${fractionLabel(level.target)} has the same length as ${fractionLabel(fraction(numerator, denominator))}.` };
  }
  if (level.type === "compare") {
    const longer = compareFractions(level.target, level.other) > 0 ? 1 : 2;
    return { kind: "ribbon", title, prompt: `Which selected length is longer: ${fractionLabel(level.target)} or ${fractionLabel(level.other)}?`,
      expected: longer, choices: [{ value: 1, label: "The first ribbon" }, { value: 2, label: "The second ribbon" }],
      correction: `${fractionLabel(level.target)} is longer than ${fractionLabel(level.other)}.` };
  }
  const missing = level.target.denominator - level.target.numerator;
  return { kind: "ribbon", title, prompt: `${fractionLabel(level.target)} is selected. How many of ${level.target.denominator} equal parts complete the whole?`,
    expected: missing, choices: selectionChoices(level.target.denominator),
    correction: `${fractionLabel(level.target)} needs ${fractionLabel(fraction(missing, level.target.denominator))} to complete one whole.` };
}

const NUMBER_NAMES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const DENOMINATOR_NAMES = { 2: "half", 3: "third", 4: "fourth", 6: "sixth", 8: "eighth", 12: "twelfth" };

export const LEVELS = Object.freeze([
  Object.freeze({ title: "Halfway across", intervals: 2, guide: true, mode: "place", fractions: ["1/2"], instructions: "Find the middle of the bridge: one of two equal intervals." }),
  Object.freeze({ title: "Quarter stepping stones", intervals: 4, guide: true, mode: "place", fractions: ["3/4"], instructions: "Each interval is one fourth. Find three fourths." }),
  Object.freeze({ title: "Thirds and sixths", intervals: 6, guide: true, mode: "place", fractions: ["1/3"], instructions: "The bridge has six equal intervals. One third is the same distance as two sixths." }),
  Object.freeze({ title: "Eighths", intervals: 8, guide: true, mode: "place", fractions: ["5/8"], instructions: "Find five of the eight equal intervals." }),
  Object.freeze({ title: "Share a stepping stone", intervals: 8, guide: true, mode: "equivalent", fractions: ["1/2", "2/4"], instructions: "These different fraction names belong at one shared position." }),
  Object.freeze({ title: "Order the stepping stones", intervals: 12, guide: false, mode: "order", fractions: ["2/3", "1/4", "5/6"], instructions: "Put the fractions in order from closest to 0 to closest to 1." }),
  Object.freeze({ title: "Which is greater?", intervals: 8, guide: false, mode: "compare", fractions: ["3/8", "5/8"], instructions: "Compare the two fractions and choose the one farther from 0." }),
  Object.freeze({ title: "Find the hidden partitions", intervals: 8, guide: false, mode: "place", fractions: ["3/4"], instructions: "The interval marks are hidden. Use the fraction and the endpoints to find the position." }),
]);

export function parseFraction(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\/([1-9]\d*)$/.test(value)) {
    throw new TypeError("A fraction must be written as two non-negative whole numbers separated by /.");
  }
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new RangeError("Fraction parts must be safe whole numbers.");
  }
  return { numerator, denominator };
}

export function compareFractions(first, second) {
  const left = parseFraction(first);
  const right = parseFraction(second);
  const difference = BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function equivalentFractions(first, second) {
  return compareFractions(first, second) === 0;
}

function greatestCommonDivisor(first, second) {
  let a = first;
  let b = second;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function fractionAtTick(tick, intervals) {
  if (!Number.isInteger(intervals) || intervals < 1 || !Number.isInteger(tick) || tick < 0 || tick > intervals) {
    throw new RangeError("A tick must be an integer within the interval.");
  }
  const divisor = greatestCommonDivisor(tick, intervals);
  return `${tick / divisor}/${intervals / divisor}`;
}

export function positionOf(fraction, intervals) {
  const { numerator, denominator } = parseFraction(fraction);
  if (!Number.isInteger(intervals) || intervals < 1) throw new RangeError("Intervals must be a positive whole number.");
  const scaled = BigInt(numerator) * BigInt(intervals);
  if (scaled % BigInt(denominator) !== 0n) throw new RangeError("The fraction does not land on an available tick.");
  const position = scaled / BigInt(denominator);
  if (position > BigInt(intervals)) throw new RangeError("The fraction is outside the unit interval.");
  return Number(position);
}

export function fractionName(fraction) {
  const { numerator, denominator } = parseFraction(fraction);
  if (denominator === 1) return NUMBER_NAMES[numerator] ?? `${numerator}`;
  const denominatorName = DENOMINATOR_NAMES[denominator];
  if (!denominatorName || !NUMBER_NAMES[numerator]) return fraction;
  return `${NUMBER_NAMES[numerator]} ${denominatorName}${numerator === 1 ? "" : "s"}`;
}

export function positionChoices(intervals) {
  return Array.from({ length: intervals + 1 }, (_, tick) => {
    const fraction = fractionAtTick(tick, intervals);
    const label = tick === 0 ? "0 (zero)" : tick === intervals ? "1 (one)" : `${fraction} (${fractionName(fraction)})`;
    return { tick, fraction, name: fractionName(fraction), label };
  });
}

export function tickFromRatio(ratio, intervals) {
  if (!Number.isInteger(intervals) || intervals < 1) throw new RangeError("Intervals must be a positive whole number.");
  if (!Number.isFinite(ratio)) throw new TypeError("A bridge position must be a finite number.");
  return Math.round(Math.min(1, Math.max(0, ratio)) * intervals);
}

export function stepTick(tick, key, intervals) {
  const moves = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  if (key === "Home") return 0;
  if (key === "End") return intervals;
  if (!(key in moves)) return undefined;
  return Math.min(intervals, Math.max(0, tick + moves[key]));
}

export function positionLabel(tick, intervals) {
  return positionChoices(intervals)[tick].label;
}

export function bridgeSummary(tick, intervals) {
  fractionAtTick(tick, intervals);
  const shaded = positionLabel(tick, intervals);
  const unshaded = positionLabel(intervals - tick, intervals);
  const numeral = (value) => (value === 0 ? "0" : value === intervals ? "1" : fractionAtTick(value, intervals));
  return {
    shaded,
    unshaded,
    text: `Shaded part from 0: ${shaded}. Unshaded part: ${unshaded}.`,
    short: `Shaded: ${numeral(tick)} · Unshaded: ${numeral(intervals - tick)}`,
  };
}

export function evaluatePlacement(fractions, tick, intervals) {
  if (!Array.isArray(fractions) || fractions.length === 0) throw new TypeError("At least one fraction is required.");
  const positions = fractions.map((fraction) => positionOf(fraction, intervals));
  if (!positions.every((position) => position === positions[0])) {
    throw new RangeError("Fractions placed together must be equivalent.");
  }
  return Number.isInteger(tick) && tick === positions[0];
}

export function isOrdered(fractions) {
  if (!Array.isArray(fractions)) throw new TypeError("Fractions must be an array.");
  return fractions.every((fraction, index) => index === 0 || compareFractions(fractions[index - 1], fraction) <= 0);
}

export function orderFractions(fractions) {
  return [...fractions].sort(compareFractions);
}

export function buildQuizQuestions() {
  const placement = (title, fraction, intervals = 8) => ({
    kind: "fraction-placement",
    title,
    prompt: `Where does ${fraction} (${fractionName(fraction)}) belong between 0 and 1?`,
    fraction,
    intervals,
    choices: positionChoices(intervals).map(({ tick, label }) => ({ value: tick, label })),
    expected: positionOf(fraction, intervals),
    correction: `${fraction} (${fractionName(fraction)}) belongs at ${fractionAtTick(positionOf(fraction, intervals), intervals)}.`,
  });
  return [
    placement("Find one half", "1/2"),
    placement("Find two fourths", "2/4"),
    placement("Find one third", "1/3", 6),
    {
      kind: "fraction-equivalent",
      title: "Recognize the same position",
      prompt: "Which fraction shares the position of 1/2?",
      choices: ["3/8", "2/4", "1/4"],
      expected: 1,
      correction: "2/4 and 1/2 are equivalent and occupy the same position.",
    },
    {
      kind: "fraction-compare",
      title: "Compare fractions",
      prompt: "Which fraction is greater: 3/8 or 5/8?",
      choices: ["3/8", "5/8"],
      expected: 1,
      correction: "5/8 is greater than 3/8 because it is farther from 0.",
    },
    {
      kind: "fraction-order",
      title: "Order fractions",
      prompt: "Put these fractions in order from least to greatest.",
      initial: ["2/3", "1/4", "5/6"],
      expected: orderFractions(["2/3", "1/4", "5/6"]),
      correction: `Correct order: ${orderFractions(["2/3", "1/4", "5/6"]).join(", ")}.`,
    },
  ];
}

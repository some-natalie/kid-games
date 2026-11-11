export const PLACES = Object.freeze(["hundreds", "tens", "ones"]);

const freezeBlocks = ({ hundreds, tens, ones }) => Object.freeze({ hundreds, tens, ones });
const totalFor = ({ hundreds, tens, ones }) => hundreds * 100 + tens * 10 + ones;

export const LEVELS = Object.freeze([
  {
    title: "Build a number with ones",
    type: "build",
    target: 6,
    start: freezeBlocks({ hundreds: 0, tens: 0, ones: 0 }),
    answer: freezeBlocks({ hundreds: 0, tens: 0, ones: 6 }),
    instructions: "Add six ones to build 6.",
    hint: "Each small square is one. Add six ones.",
  },
  {
    title: "Bundle ten ones into a ten",
    type: "build",
    target: 14,
    start: freezeBlocks({ hundreds: 0, tens: 0, ones: 14 }),
    answer: freezeBlocks({ hundreds: 0, tens: 1, ones: 4 }),
    instructions: "These 14 ones can be regrouped. Exchange ten ones for one ten to show 1 ten and 4 ones.",
    hint: "Ten ones have the same value as one ten. Use the exchange button beside Ones.",
  },
  {
    title: "Unbundle a ten into ones",
    type: "build",
    target: 14,
    start: freezeBlocks({ hundreds: 0, tens: 1, ones: 4 }),
    answer: freezeBlocks({ hundreds: 0, tens: 0, ones: 14 }),
    instructions: "Show the same 14 as 14 ones. Exchange the ten into ten ones.",
    hint: "One ten is worth ten ones. Exchange the ten into ones; the total stays 14.",
  },
  {
    title: "Compare two numbers",
    type: "compare",
    left: 17,
    right: 23,
    instructions: "Choose the greater quantity. Compare the tens first.",
    hint: "17 has 1 ten and 23 has 2 tens. Which has more tens?",
  },
  {
    title: "Bundle ones to make 40",
    type: "build",
    target: 40,
    start: freezeBlocks({ hundreds: 0, tens: 0, ones: 40 }),
    answer: freezeBlocks({ hundreds: 0, tens: 4, ones: 0 }),
    instructions: "Regroup 40 ones as tens. Make 4 tens and 0 ones: the zero shows there are no leftover ones.",
    hint: "Exchange groups of ten ones for tens until only tens remain.",
  },
  {
    title: "Build 105",
    type: "build",
    target: 105,
    start: freezeBlocks({ hundreds: 0, tens: 0, ones: 105 }),
    answer: freezeBlocks({ hundreds: 1, tens: 0, ones: 5 }),
    instructions: "Regroup 105 ones into 1 hundred, 0 tens, and 5 ones.",
    hint: "Exchange ten ones for a ten, then exchange ten tens for a hundred. Keep 5 ones.",
  },
  {
    title: "Bundle tens into a hundred",
    type: "build",
    target: 130,
    start: freezeBlocks({ hundreds: 0, tens: 13, ones: 0 }),
    answer: freezeBlocks({ hundreds: 1, tens: 3, ones: 0 }),
    instructions: "Exchange ten tens for one hundred. Show 130 as 1 hundred, 3 tens, and 0 ones.",
    hint: "Ten tens have the same value as one hundred. The 3 tens and 0 ones stay.",
  },
  {
    title: "Compare numbers with zero tens",
    type: "compare",
    left: 305,
    right: 350,
    instructions: "Choose the greater quantity. Notice the zero tens in 305.",
    hint: "Both numbers have 3 hundreds. Compare their tens: 305 has 0 and 350 has 5.",
  },
  {
    title: "Build 206",
    type: "build",
    target: 206,
    start: freezeBlocks({ hundreds: 0, tens: 20, ones: 6 }),
    answer: freezeBlocks({ hundreds: 2, tens: 0, ones: 6 }),
    instructions: "Regroup the tens to show 206 as 2 hundreds, 0 tens, and 6 ones.",
    hint: "Exchange ten tens for a hundred twice. Keep all 6 ones.",
  },
  {
    title: "Compare three-digit numbers",
    type: "compare",
    left: 419,
    right: 491,
    instructions: "Choose the greater quantity. Compare the hundreds, then the tens if needed.",
    hint: "Both have 4 hundreds. Compare 1 ten with 9 tens.",
  },
].map((level) => Object.freeze(level)));

function assertBlocks(blocks) {
  if (!blocks || PLACES.some((place) => !Number.isSafeInteger(blocks[place]) ||
      blocks[place] < 0 || blocks[place] > 999) || totalFor(blocks) > 999) {
    throw new RangeError("Blocks must represent a whole number from 0 to 999.");
  }
}

export function makeBlocks(hundreds = 0, tens = 0, ones = 0) {
  const blocks = { hundreds, tens, ones };
  assertBlocks(blocks);
  return freezeBlocks(blocks);
}

export function representedNumber(blocks) {
  assertBlocks(blocks);
  return totalFor(blocks);
}

export function adjustBlock(blocks, place, amount) {
  assertBlocks(blocks);
  if (!PLACES.includes(place) || !Number.isInteger(amount) || !amount) {
    throw new RangeError("Choose a place and add or remove a whole block.");
  }
  const next = { ...blocks, [place]: blocks[place] + amount };
  assertBlocks(next);
  return freezeBlocks(next);
}

export function exchangeBlocks(blocks, place, direction) {
  assertBlocks(blocks);
  if (!["ones", "tens"].includes(place) || !["up", "down"].includes(direction)) {
    throw new RangeError("Exchange ones and tens only, in a valid direction.");
  }
  const higherPlace = place === "ones" ? "tens" : "hundreds";
  const next = { ...blocks };
  if (direction === "up") {
    if (next[place] < 10) return null;
    next[place] -= 10;
    next[higherPlace] += 1;
  } else {
    if (next[higherPlace] < 1 || next[place] > 989) return null;
    next[higherPlace] -= 1;
    next[place] += 10;
  }
  assertBlocks(next);
  return freezeBlocks(next);
}

function blockDescription(blocks) {
  return `${blocks.hundreds} ${blocks.hundreds === 1 ? "hundred" : "hundreds"}, ` +
    `${blocks.tens} ${blocks.tens === 1 ? "ten" : "tens"}, and ` +
    `${blocks.ones} ${blocks.ones === 1 ? "one" : "ones"}`;
}

function placeDescription(count, place) {
  const singular = { hundreds: "hundred", tens: "ten", ones: "one" }[place];
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function comparisonExplanation(left, right) {
  if (!Number.isSafeInteger(left) || left < 0 || left > 999 ||
      !Number.isSafeInteger(right) || right < 0 || right > 999 || left === right) {
    throw new RangeError("Compare two different whole numbers from 0 to 999.");
  }
  const greater = Math.max(left, right);
  const smaller = Math.min(left, right);
  const greaterBlocks = makeBlocks(Math.floor(greater / 100), Math.floor(greater / 10) % 10, greater % 10);
  const smallerBlocks = makeBlocks(Math.floor(smaller / 100), Math.floor(smaller / 10) % 10, smaller % 10);
  const differingPlace = PLACES.find((place) => greaterBlocks[place] !== smallerBlocks[place]);
  const reason = `${greater} has ${placeDescription(greaterBlocks[differingPlace], differingPlace)}, ` +
    `while ${smaller} has ${placeDescription(smallerBlocks[differingPlace], differingPlace)}.`;
  return `${greater} is greater than ${smaller}: ${reason}`;
}

export function isLevelComplete(levelIndex, blocks, comparison) {
  const level = LEVELS[levelIndex];
  if (!level) throw new RangeError("Choose an existing level.");
  if (level.type === "build") {
    assertBlocks(blocks);
    return representedNumber(blocks) === level.target &&
      PLACES.every((place) => blocks[place] === level.answer[place]);
  }
  return comparison === (level.left > level.right ? "left" : "right");
}

export function makeQuizQuestion(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) throw new RangeError("Choose an existing Place-Value Builders level.");
  const title = `Level ${levelIndex + 1}: ${level.title}`;
  if (level.type === "build") {
    const blocks = level.answer;
    const choices = [...new Set([level.target, Math.max(0, level.target - 10), Math.min(999, level.target + 10), level.target === 105 ? 150 : 0])]
      .sort((a, b) => a - b).map((value) => ({ value, label: String(value) }));
    return {
      kind: "place-value",
      title,
      prompt: `Which number is shown by ${blockDescription(blocks)}?`,
      expected: level.target,
      choices,
      correction: `${blockDescription(blocks)} makes ${level.target} (${blocks.hundreds * 100} + ${blocks.tens * 10} + ${blocks.ones}).`,
    };
  }
  const greater = level.left > level.right ? "left" : "right";
  return {
    kind: "place-value",
    title,
    prompt: `Which is greater, ${level.left} or ${level.right}?`,
    expected: greater === "left" ? 1 : 2,
    choices: [{ value: 1, label: String(level.left) }, { value: 2, label: String(level.right) }],
    correction: comparisonExplanation(level.left, level.right),
  };
}

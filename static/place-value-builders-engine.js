export const PLACES = Object.freeze(["thousands", "hundreds", "tens", "ones"]);
export const PLACE_VALUES = Object.freeze({ thousands: 1000, hundreds: 100, tens: 10, ones: 1 });

const freezeBlocks = ({ thousands = 0, hundreds, tens, ones }) => Object.freeze({ thousands, hundreds, tens, ones });
const totalFor = (blocks) => PLACES.reduce((sum, place) => sum + blocks[place] * PLACE_VALUES[place], 0);

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
  {
    title: "Bundle hundreds into a thousand",
    type: "build",
    target: 1000,
    start: freezeBlocks({ hundreds: 10, tens: 0, ones: 0 }),
    answer: freezeBlocks({ thousands: 1, hundreds: 0, tens: 0, ones: 0 }),
    instructions: "Regroup ten hundred flats into one thousand cube. A thousand cube is 10 cubes wide, 10 deep, and 10 high.",
    hint: "Ten hundred flats stack to make one thousand cube. Drag a hundred to Thousands to trade all ten, or use the exchange button.",
  },
  {
    title: "Build with thousands",
    type: "build",
    target: 1234,
    start: freezeBlocks({ hundreds: 0, tens: 0, ones: 0 }),
    answer: freezeBlocks({ thousands: 1, hundreds: 2, tens: 3, ones: 4 }),
    instructions: "Build 1234 with thousand cubes, hundred flats, ten rods, and ones.",
    hint: "1234 has 1 thousand, 2 hundreds, 3 tens, and 4 ones. Drag each type from the tray into its matching place.",
  },
].map((level) => Object.freeze(level)));

function assertBlocks(blocks) {
  if (!blocks || PLACES.some((place) => !Number.isSafeInteger(blocks[place]) ||
      blocks[place] < 0 || blocks[place] > 9999) || totalFor(blocks) > 9999) {
    throw new RangeError("Blocks must represent a whole number from 0 to 9999.");
  }
}

export function makeBlocks(hundreds = 0, tens = 0, ones = 0, thousands = 0) {
  const blocks = { thousands, hundreds, tens, ones };
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
  if (!["ones", "tens", "hundreds"].includes(place) || !["up", "down"].includes(direction)) {
    throw new RangeError("Exchange ones, tens, or hundreds in a valid direction.");
  }
  const higherPlace = PLACES[PLACES.indexOf(place) - 1];
  const next = { ...blocks };
  if (direction === "up") {
    if (next[place] < 10) return null;
    next[place] -= 10;
    next[higherPlace] += 1;
  } else {
    if (next[higherPlace] < 1) return null;
    next[higherPlace] -= 1;
    next[place] += 10;
  }
  assertBlocks(next);
  return freezeBlocks(next);
}

export function blockDescription(blocks) {
  assertBlocks(blocks);
  return `${blocks.thousands} ${blocks.thousands === 1 ? "thousand" : "thousands"}, ` +
    `${blocks.hundreds} ${blocks.hundreds === 1 ? "hundred" : "hundreds"}, ` +
    `${blocks.tens} ${blocks.tens === 1 ? "ten" : "tens"}, and ` +
    `${blocks.ones} ${blocks.ones === 1 ? "one" : "ones"}`;
}

export function blockCounts(blocks) {
  assertBlocks(blocks);
  return PLACES.map((place) => blocks[place]);
}

export function blocksFromCounts(counts) {
  if (!Array.isArray(counts) || counts.length !== PLACES.length) {
    throw new RangeError("Provide a count for each of the four places.");
  }
  return makeBlocks(counts[1], counts[2], counts[3], counts[0]);
}

export function blocksForNumber(number) {
  if (!Number.isSafeInteger(number) || number < 0 || number > 9999) {
    throw new RangeError("Choose a whole number from 0 to 9999.");
  }
  return makeBlocks(Math.floor(number / 100) % 10, Math.floor(number / 10) % 10, number % 10,
    Math.floor(number / 1000));
}

export function dropBlock(blocks, place, source, target) {
  assertBlocks(blocks);
  if (!PLACES.includes(place) || !["tray", "workspace"].includes(source)) {
    throw new RangeError("Choose a block from the tray or workspace.");
  }
  if (source === "tray" && target === place) return adjustBlock(blocks, place, 1);
  if (source === "workspace" && target === "tray") return adjustBlock(blocks, place, -1);
  if (source === "workspace" && target === place) return blocks;
  if (source === "workspace" && PLACES.includes(target)) {
    const difference = PLACES.indexOf(target) - PLACES.indexOf(place);
    if (Math.abs(difference) === 1) {
      const lower = difference < 0 ? place : target;
      const exchanged = exchangeBlocks(blocks, lower, difference < 0 ? "up" : "down");
      if (exchanged) return exchanged;
      throw new RangeError(`You need ten ${place} to make one ${target.slice(0, -1)}.`);
    }
  }
  throw new RangeError("Drop a tray block in its matching place. Exchange workspace blocks with a neighboring place, or return them to the tray.");
}

function placeDescription(count, place) {
  const singular = place.slice(0, -1);
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function comparisonExplanation(left, right) {
  if (!Number.isSafeInteger(left) || left < 0 || left > 9999 ||
      !Number.isSafeInteger(right) || right < 0 || right > 9999 || left === right) {
    throw new RangeError("Compare two different whole numbers from 0 to 9999.");
  }
  const greater = Math.max(left, right);
  const smaller = Math.min(left, right);
  const greaterBlocks = blocksForNumber(greater);
  const smallerBlocks = blocksForNumber(smaller);
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
    return {
      kind: "place-value-build",
      title,
      prompt: levelIndex === 2 ? "Show 14 using only ones."
        : `Build ${level.target} using its place-value digits, with fewer than ten blocks in each place.`,
      expected: blockCounts(blocks),
      initial: level.start,
      correction: `${blockDescription(blocks)} makes ${level.target}.`,
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

import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, adjustBlock, blockCounts, blocksFromCounts, comparisonExplanation, dropBlock,
  exchangeBlocks, isLevelComplete, makeBlocks, makeQuizQuestion, representedNumber,
} from "../../../static/place-value-builders-engine.js";
import { gradeQuiz } from "../../../static/quiz-engine.js";

test("the levels progress from ones and exchanges through thousands", () => {
  assert.equal(LEVELS.length, 12);
  assert.deepEqual(LEVELS.map(({ type }) => type), [
    "build", "build", "build", "compare", "build", "build", "build", "compare", "build", "compare", "build", "build",
  ]);
  assert.equal(LEVELS[4].target, 40);
  assert.deepEqual(LEVELS[5].answer, makeBlocks(1, 0, 5));
  assert.deepEqual(LEVELS[7].left, 305);
  assert.ok(LEVELS.every((level) => !("age" in level) && !("ages" in level)));
});

test("adding and removing blocks validates inputs and keeps totals in range", () => {
  const blocks = makeBlocks(1, 2, 3);
  assert.equal(representedNumber(blocks), 123);
  assert.deepEqual(adjustBlock(blocks, "ones", 1), makeBlocks(1, 2, 4));
  assert.deepEqual(blocks, makeBlocks(1, 2, 3));
  assert.throws(() => makeBlocks(-1, 0, 0), RangeError);
  assert.throws(() => makeBlocks(0, 0, 0, 10), RangeError);
  assert.throws(() => adjustBlock(blocks, "hundreds", -2), RangeError);
  assert.throws(() => adjustBlock(blocks, "ones", 0), RangeError);
  assert.throws(() => adjustBlock(blocks, "unknown", 1), RangeError);
});

test("every exchange conserves the represented total in both directions", () => {
  const cases = [
    [makeBlocks(0, 0, 14), "ones", "up", makeBlocks(0, 1, 4)],
    [makeBlocks(0, 1, 4), "ones", "down", makeBlocks(0, 0, 14)],
    [makeBlocks(0, 13, 0), "tens", "up", makeBlocks(1, 3, 0)],
    [makeBlocks(1, 3, 0), "tens", "down", makeBlocks(0, 13, 0)],
    [makeBlocks(12, 3, 4), "hundreds", "up", makeBlocks(2, 3, 4, 1)],
    [makeBlocks(2, 3, 4, 1), "hundreds", "down", makeBlocks(12, 3, 4)],
  ];
  for (const [before, place, direction, expected] of cases) {
    const after = exchangeBlocks(before, place, direction);
    assert.deepEqual(after, expected);
    assert.equal(representedNumber(after), representedNumber(before));
  }
  assert.equal(exchangeBlocks(makeBlocks(), "ones", "up"), null);
  assert.equal(exchangeBlocks(makeBlocks(), "tens", "down"), null);
  assert.throws(() => exchangeBlocks(makeBlocks(), "thousands", "up"), RangeError);
});

test("build checks require the target's place-value representation, including zero places", () => {
  assert.equal(isLevelComplete(1, makeBlocks(0, 1, 4)), true);
  assert.equal(isLevelComplete(1, makeBlocks(0, 0, 14)), false);
  assert.equal(isLevelComplete(4, makeBlocks(0, 4, 0)), true);
  assert.equal(isLevelComplete(5, makeBlocks(1, 0, 5)), true);
  assert.equal(isLevelComplete(5, makeBlocks(1, 0, 4)), false);
  assert.equal(isLevelComplete(6, makeBlocks(1, 3, 0)), true);
  assert.equal(isLevelComplete(8, makeBlocks(2, 0, 6)), true);
  assert.equal(isLevelComplete(10, makeBlocks(0, 0, 0, 1)), true);
  assert.equal(isLevelComplete(10, makeBlocks(10, 0, 0)), false);
  assert.equal(isLevelComplete(11, makeBlocks(2, 3, 4, 1)), true);
  assert.throws(() => isLevelComplete(LEVELS.length, makeBlocks()), RangeError);
});

test("comparisons explain the first place that differs", () => {
  assert.equal(comparisonExplanation(17, 23), "23 is greater than 17: 23 has 2 tens, while 17 has 1 ten.");
  assert.match(comparisonExplanation(305, 350), /350 has 5 tens, while 305 has 0 tens/);
  assert.match(comparisonExplanation(419, 491), /491 has 9 tens, while 419 has 1 ten/);
  assert.match(comparisonExplanation(1234, 2345), /2345 has 2 thousands, while 1234 has 1 thousand/);
  assert.equal(isLevelComplete(3, undefined, "right"), true);
  assert.equal(isLevelComplete(3, undefined, "left"), false);
  assert.throws(() => comparisonExplanation(20, 20), RangeError);
});

test("quiz builds require exact block counts, allow duplicate zero counts, and grade only the final response", () => {
  const questions = LEVELS.map((_, index) => makeQuizQuestion(index));
  assert.equal(questions.length, LEVELS.length);
  assert.ok(questions.every(({ kind, expected, choices, correction }) =>
    (kind === "place-value-build" ? Array.isArray(expected) : choices.some(({ value }) => value === expected)) && correction));
  assert.match(questions[5].prompt, /Build 105/);
  assert.deepEqual(questions[5].expected, [0, 1, 0, 5]);
  const responses = [blockCounts(makeBlocks(0, 0, 14))];
  assert.equal(gradeQuiz([questions[1]], responses).correct, 0);
  responses[0] = blockCounts(makeBlocks(0, 1, 4));
  assert.equal(gradeQuiz([questions[1]], responses).correct, 1);
  assert.equal(gradeQuiz([questions[1]], [[0, 1, 4]]).correct, 0);
  assert.equal(gradeQuiz([questions[1]], [[0, 1, 4, 0]]).correct, 0);
  assert.equal(gradeQuiz([questions[1]], []).correct, 0);
  assert.equal(gradeQuiz([questions[10]], [[1, 0, 0, 0]]).correct, 1);
  assert.equal(gradeQuiz([questions[10]], [[0, 10, 0, 0]]).correct, 0);
  assert.deepEqual(blocksFromCounts(questions[11].expected), LEVELS[11].answer);
  assert.throws(() => blocksFromCounts([1, 2]), RangeError);
  assert.throws(() => blocksFromCounts([0, 0, 0, -1]), RangeError);
  assert.equal(questions[7].expected, 2);
  assert.match(questions[7].correction, /350 is greater than 305/);
  assert.throws(() => makeQuizQuestion(LEVELS.length), RangeError);
});

test("dragging adds and removes the right block type, and neighboring drops exchange without changing value", () => {
  for (const [place, value] of [["ones", 1], ["tens", 10], ["hundreds", 100], ["thousands", 1000]]) {
    const added = dropBlock(makeBlocks(), place, "tray", place);
    assert.equal(representedNumber(added), value);
    assert.equal(representedNumber(dropBlock(added, place, "workspace", "tray")), 0);
    assert.throws(() => dropBlock(makeBlocks(), place, "tray", place === "ones" ? "tens" : "ones"), RangeError);
  }
  const hundredFlats = makeBlocks(10, 0, 0);
  const thousand = dropBlock(hundredFlats, "hundreds", "workspace", "thousands");
  assert.deepEqual(thousand, makeBlocks(0, 0, 0, 1));
  assert.deepEqual(dropBlock(thousand, "thousands", "workspace", "hundreds"), hundredFlats);
  assert.deepEqual(hundredFlats, makeBlocks(10, 0, 0));
  assert.throws(() => dropBlock(makeBlocks(9, 0, 0), "hundreds", "workspace", "thousands"), /need ten hundreds/);
  assert.throws(() => dropBlock(thousand, "thousands", "workspace", "ones"), RangeError);
  assert.throws(() => dropBlock(makeBlocks(9, 9, 9, 9), "ones", "tray", "ones"), RangeError);
  assert.throws(() => makeBlocks(9, 9, 10, 9), RangeError);
});

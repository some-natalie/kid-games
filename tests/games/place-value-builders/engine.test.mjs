import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, adjustBlock, comparisonExplanation, exchangeBlocks, isLevelComplete,
  makeBlocks, makeQuizQuestion, representedNumber,
} from "../../../static/place-value-builders-engine.js";

test("the levels progress from ones and exchanges to hundreds and comparisons", () => {
  assert.equal(LEVELS.length, 10);
  assert.deepEqual(LEVELS.map(({ type }) => type), [
    "build", "build", "build", "compare", "build", "build", "build", "compare", "build", "compare",
  ]);
  assert.equal(LEVELS[4].target, 40);
  assert.deepEqual(LEVELS[5].answer, { hundreds: 1, tens: 0, ones: 5 });
  assert.deepEqual(LEVELS[7].left, 305);
  assert.ok(LEVELS.every((level) => !("age" in level) && !("ages" in level)));
});

test("adding and removing blocks validates inputs and keeps totals in range", () => {
  const blocks = makeBlocks(1, 2, 3);
  assert.equal(representedNumber(blocks), 123);
  assert.deepEqual(adjustBlock(blocks, "ones", 1), { hundreds: 1, tens: 2, ones: 4 });
  assert.deepEqual(blocks, { hundreds: 1, tens: 2, ones: 3 });
  assert.throws(() => makeBlocks(-1, 0, 0), RangeError);
  assert.throws(() => makeBlocks(10, 0, 0), RangeError);
  assert.throws(() => adjustBlock(blocks, "hundreds", -2), RangeError);
  assert.throws(() => adjustBlock(blocks, "ones", 0), RangeError);
  assert.throws(() => adjustBlock(blocks, "unknown", 1), RangeError);
});

test("every exchange conserves the represented total in both directions", () => {
  const cases = [
    [makeBlocks(0, 0, 14), "ones", "up", { hundreds: 0, tens: 1, ones: 4 }],
    [makeBlocks(0, 1, 4), "ones", "down", { hundreds: 0, tens: 0, ones: 14 }],
    [makeBlocks(0, 13, 0), "tens", "up", { hundreds: 1, tens: 3, ones: 0 }],
    [makeBlocks(1, 3, 0), "tens", "down", { hundreds: 0, tens: 13, ones: 0 }],
  ];
  for (const [before, place, direction, expected] of cases) {
    const after = exchangeBlocks(before, place, direction);
    assert.deepEqual(after, expected);
    assert.equal(representedNumber(after), representedNumber(before));
  }
  assert.equal(exchangeBlocks(makeBlocks(), "ones", "up"), null);
  assert.equal(exchangeBlocks(makeBlocks(), "tens", "down"), null);
  assert.throws(() => exchangeBlocks(makeBlocks(), "hundreds", "up"), RangeError);
});

test("build checks require the target's place-value representation, including zero places", () => {
  assert.equal(isLevelComplete(1, makeBlocks(0, 1, 4)), true);
  assert.equal(isLevelComplete(1, makeBlocks(0, 0, 14)), false);
  assert.equal(isLevelComplete(4, makeBlocks(0, 4, 0)), true);
  assert.equal(isLevelComplete(5, makeBlocks(1, 0, 5)), true);
  assert.equal(isLevelComplete(5, makeBlocks(1, 0, 4)), false);
  assert.equal(isLevelComplete(6, makeBlocks(1, 3, 0)), true);
  assert.equal(isLevelComplete(8, makeBlocks(2, 0, 6)), true);
  assert.throws(() => isLevelComplete(LEVELS.length, makeBlocks()), RangeError);
});

test("comparisons explain the first place that differs", () => {
  assert.equal(comparisonExplanation(17, 23), "23 is greater than 17: 23 has 2 tens, while 17 has 1 ten.");
  assert.match(comparisonExplanation(305, 350), /350 has 5 tens, while 305 has 0 tens/);
  assert.match(comparisonExplanation(419, 491), /491 has 9 tens, while 419 has 1 ten/);
  assert.equal(isLevelComplete(3, undefined, "right"), true);
  assert.equal(isLevelComplete(3, undefined, "left"), false);
  assert.throws(() => comparisonExplanation(20, 20), RangeError);
});

test("quiz questions cover each level with choices, exact answers, and corrections", () => {
  const questions = LEVELS.map((_, index) => makeQuizQuestion(index));
  assert.equal(questions.length, LEVELS.length);
  assert.ok(questions.every(({ kind, expected, choices, correction }) =>
    kind === "place-value" && choices.some(({ value }) => value === expected) && correction));
  assert.match(questions[5].prompt, /1 hundred, 0 tens, and 5 ones/);
  assert.equal(questions[7].expected, 2);
  assert.match(questions[7].correction, /350 is greater than 305/);
  assert.throws(() => makeQuizQuestion(LEVELS.length), RangeError);
});

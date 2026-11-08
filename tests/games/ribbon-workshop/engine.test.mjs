import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, PARTITIONS, checkExercise, compareFractions, fraction, fractionDescription,
  fractionLabel, fractionsEquivalent, makeQuizQuestion, partitionRibbon,
} from "../../../static/ribbon-workshop-engine.js";

test("the nine levels progress through age-appropriate fraction skills", () => {
  assert.equal(LEVELS.length, 9);
  assert.deepEqual(LEVELS.map((level) => level.age), [
    "6–7", "6–7", "6–7", "7–8", "7–8", "8–9", "8–9", "8–9", "8–9",
  ]);
  assert.deepEqual(LEVELS.map((level) => level.type), [
    "select", "select", "select", "select", "equivalent", "equivalent", "equivalent", "compare", "complete",
  ]);
});

test("each supported fold partitions the whole into equal integer-sized steps", () => {
  assert.deepEqual(PARTITIONS, [2, 3, 4, 6, 8]);
  for (const denominator of PARTITIONS) {
    const parts = partitionRibbon(denominator);
    assert.equal(parts.length, denominator);
    assert.deepEqual(parts.map(({ start, end }) => end - start), Array(denominator).fill(1));
    assert.deepEqual(parts.map(({ index }) => index), Array.from({ length: denominator }, (_, index) => index));
  }
  assert.throws(() => partitionRibbon(5), RangeError);
});

test("fractions use integer notation and exact cross-product comparison", () => {
  assert.equal(fractionLabel(fraction(3, 4)), "3/4");
  assert.equal(fractionDescription(fraction(2, 6)), "2/6 (2 of 6 equal parts)");
  assert.equal(compareFractions(fraction(1, 2), fraction(2, 4)), 0);
  assert.equal(compareFractions(fraction(3, 4), fraction(2, 3)), 1);
  assert.equal(compareFractions(fraction(1, 3), fraction(1, 2)), -1);
  assert.equal(fractionsEquivalent(fraction(4, 8), fraction(1, 2)), true);
  assert.equal(compareFractions(fraction(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1),
    fraction(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER - 2)), -1);
  for (const values of [[-1, 2], [1, 0], [1.5, 2], [1, Number.MAX_SAFE_INTEGER + 1]]) {
    assert.throws(() => fraction(...values), RangeError);
  }
});

test("selected labels agree with selected parts and incomplete or gapped lengths are rejected", () => {
  assert.equal(checkExercise(0, [{ denominator: 2, selected: [0] }]), true);
  assert.equal(checkExercise(0, [{ denominator: 8, selected: [0, 1, 2, 3] }]), true);
  assert.equal(checkExercise(0, [{ denominator: 4, selected: [0, 2] }]), false);
  assert.equal(checkExercise(0, [{ denominator: 4, selected: [1, 2] }]), false);
  assert.equal(checkExercise(2, [{ denominator: 4, selected: [0, 1] }]), false);
  assert.equal(checkExercise(0, [{ denominator: 2, selected: [0, 0] }]), false);
  assert.equal(checkExercise(0, [{ denominator: 2, selected: [2] }]), false);
});

test("aligned ribbons accept equivalent lengths across different partitions", () => {
  assert.equal(checkExercise(4, [
    { denominator: 2, selected: [0] },
    { denominator: 4, selected: [0, 1] },
  ]), true);
  assert.equal(checkExercise(5, [
    { denominator: 2, selected: [0] },
    { denominator: 8, selected: [0, 1, 2] },
  ]), false);
  assert.equal(checkExercise(5, [
    { denominator: 2, selected: [0] },
    { denominator: 8, selected: [0, 1, 2, 3] },
  ]), true);
  assert.equal(checkExercise(6, [
    { denominator: 3, selected: [0] },
    { denominator: 6, selected: [0, 1] },
  ]), true);
});

test("comparison and completion compare exact quantities and the missing contiguous part", () => {
  assert.equal(checkExercise(7, [
    { denominator: 4, selected: [0, 1, 2] },
    { denominator: 3, selected: [0, 1] },
  ]), true);
  assert.equal(checkExercise(7, [
    { denominator: 4, selected: [0, 1] },
    { denominator: 3, selected: [0, 1] },
  ]), false);
  assert.equal(checkExercise(8, [
    { denominator: 8, selected: [0, 1, 2, 3, 4] },
    { denominator: 8, selected: [5, 6, 7] },
  ]), true);
  assert.equal(checkExercise(8, [
    { denominator: 8, selected: [0, 1, 2, 3, 4] },
    { denominator: 8, selected: [0, 1, 2] },
  ]), false);
});

test("quiz questions cover the same skills with exact answers and corrections", () => {
  const questions = LEVELS.map((_, index) => makeQuizQuestion(index));
  assert.equal(questions.length, LEVELS.length);
  assert.equal(questions[0].expected, 1);
  assert.equal(questions[4].expected, 2);
  assert.equal(questions[5].expected, 4);
  assert.equal(questions[6].expected, 2);
  assert.equal(questions[7].expected, 1);
  assert.equal(questions[8].expected, 3);
  assert.ok(questions.every((question) => question.kind === "ribbon" &&
    question.choices.some(({ value }) => value === question.expected) && question.correction));
  assert.throws(() => makeQuizQuestion(LEVELS.length), RangeError);
});

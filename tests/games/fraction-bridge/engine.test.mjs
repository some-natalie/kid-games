import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, buildQuizQuestions, compareFractions, equivalentFractions, evaluatePlacement,
  fractionAtTick, fractionName, isOrdered, orderFractions, parseFraction, positionChoices, positionOf,
} from "../../../static/fraction-bridge-engine.js";

test("the scaffold moves from visible halves and quarters to reduced-guide challenges", () => {
  assert.equal(LEVELS.length, 8);
  assert.deepEqual(LEVELS.slice(0, 4).map(({ intervals }) => intervals), [2, 4, 6, 8]);
  assert.ok(LEVELS.slice(0, 5).every((level) => level.guide));
  assert.equal(LEVELS[4].mode, "equivalent");
  assert.equal(LEVELS[5].mode, "order");
  assert.equal(LEVELS[6].mode, "compare");
  assert.equal(LEVELS[7].guide, false);
});

test("ticks count equal intervals, not the number of tick marks, and include both boundaries", () => {
  assert.equal(positionChoices(2).length, 3);
  assert.deepEqual(positionChoices(2).map(({ tick, fraction }) => [tick, fraction]), [
    [0, "0/1"], [1, "1/2"], [2, "1/1"],
  ]);
  assert.equal(positionOf("1/3", 6), 2);
  assert.equal(positionOf("5/6", 6), 5);
  assert.equal(fractionAtTick(0, 8), "0/1");
  assert.equal(fractionAtTick(8, 8), "1/1");
  assert.throws(() => positionOf("1/3", 8), RangeError);
  assert.throws(() => positionOf("9/8", 8), RangeError);
});

test("fractions compare and match by exact rational value", () => {
  assert.equal(compareFractions("1/3", "2/6"), 0);
  assert.equal(equivalentFractions("1/2", "2/4"), true);
  assert.equal(compareFractions("3/8", "1/2"), -1);
  assert.equal(compareFractions("5/6", "3/4"), 1);
  assert.equal(compareFractions("9007199254740990/9007199254740991", "9007199254740989/9007199254740990"), 1);
  assert.equal(fractionName("5/8"), "five eighths");
  assert.equal(fractionName("1/3"), "one third");
});

test("equivalent fractions share one valid placement, with no tick-mark conflict", () => {
  assert.equal(evaluatePlacement(["1/2", "2/4"], 2, 4), true);
  assert.equal(evaluatePlacement(["1/2", "2/4"], 1, 4), false);
  assert.throws(() => evaluatePlacement(["1/2", "1/3"], 2, 6), RangeError);
});

test("ordering uses exact comparisons and accepts ties", () => {
  assert.equal(isOrdered(["1/4", "2/8", "3/4"]), true);
  assert.equal(isOrdered(["1/4", "1/3", "5/6"]), true);
  assert.equal(isOrdered(["2/3", "1/4", "5/6"]), false);
  assert.deepEqual(orderFractions(["2/3", "1/4", "5/6"]), ["1/4", "2/3", "5/6"]);
});

test("fraction parsing rejects malformed values and quiz prompts include all skill types", () => {
  assert.deepEqual(parseFraction("2/4"), { numerator: 2, denominator: 4 });
  for (const fraction of ["1/0", "-1/2", "1/2.5", "1/2/3", "01/2"]) {
    assert.throws(() => parseFraction(fraction), TypeError);
  }
  assert.deepEqual(buildQuizQuestions().map((question) => question.kind), [
    "fraction-placement", "fraction-placement", "fraction-placement",
    "fraction-equivalent", "fraction-compare", "fraction-order",
  ]);
});

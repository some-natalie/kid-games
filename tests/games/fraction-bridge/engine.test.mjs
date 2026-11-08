import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, bridgeSummary, buildQuizQuestions, compareFractions, equivalentFractions, evaluatePlacement,
  fractionAtTick, fractionName, isOrdered, orderFractions, parseFraction, positionChoices, positionLabel,
  positionOf, stepTick, tickFromRatio,
} from "../../../static/fraction-bridge-engine.js";
import { GAME_CELEBRATIONS } from "../../../static/game-celebrations.js";
import { MOTIONS } from "../../../static/alphabet-celebration.js";

const BRIDGE_CELEBRATIONS = GAME_CELEBRATIONS["fraction-bridge"];

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

test("taps and drags snap to the nearest valid tick and stay on the bridge", () => {
  assert.equal(tickFromRatio(0, 8), 0);
  assert.equal(tickFromRatio(0.6, 8), 5);
  assert.equal(tickFromRatio(0.5625, 8), 5);
  assert.equal(tickFromRatio(0.55, 8), 4);
  assert.equal(tickFromRatio(0.74, 2), 1);
  assert.equal(tickFromRatio(-0.4, 4), 0);
  assert.equal(tickFromRatio(1.7, 4), 4);
  assert.throws(() => tickFromRatio(Number.NaN, 4), TypeError);
  assert.throws(() => tickFromRatio(0.5, 0), RangeError);
});

test("keyboard steps move one interval and clamp at the endpoints", () => {
  assert.equal(stepTick(0, "ArrowRight", 4), 1);
  assert.equal(stepTick(1, "ArrowUp", 4), 2);
  assert.equal(stepTick(2, "ArrowLeft", 4), 1);
  assert.equal(stepTick(0, "ArrowDown", 4), 0);
  assert.equal(stepTick(4, "ArrowRight", 4), 4);
  assert.equal(stepTick(2, "Home", 4), 0);
  assert.equal(stepTick(2, "End", 4), 4);
  assert.equal(stepTick(2, "Tab", 4), undefined);
});

test("bridge labels and shading describe the chosen part and the unshaded rest", () => {
  assert.equal(positionLabel(1, 2), "1/2 (one half)");
  assert.equal(positionLabel(0, 8), "0 (zero)");
  assert.equal(positionLabel(8, 8), "1 (one)");
  assert.deepEqual(bridgeSummary(6, 8), {
    shaded: "3/4 (three fourths)",
    unshaded: "1/4 (one fourth)",
    text: "Shaded part from 0: 3/4 (three fourths). Unshaded part: 1/4 (one fourth).",
    short: "Shaded: 3/4 · Unshaded: 1/4",
  });
  assert.equal(bridgeSummary(0, 8).short, "Shaded: 0 · Unshaded: 1");
  assert.equal(bridgeSummary(8, 8).short, "Shaded: 1 · Unshaded: 0");
  assert.equal(bridgeSummary(0, 4).unshaded, "1 (one)");
  assert.equal(bridgeSummary(4, 4).shaded, "1 (one)");
  assert.throws(() => bridgeSummary(5, 4), RangeError);
});

test("quiz placement questions carry the bridge size and every tick label", () => {
  const placements = buildQuizQuestions().filter(({ kind }) => kind === "fraction-placement");
  assert.deepEqual(placements.map(({ fraction, intervals, expected }) => [fraction, intervals, expected]),
    [["1/2", 8, 4], ["2/4", 8, 4], ["1/3", 6, 2]]);
  for (const question of placements) {
    assert.equal(question.choices.length, question.intervals + 1);
    assert.deepEqual(question.choices.map(({ value }) => value), Array.from({ length: question.intervals + 1 }, (_, tick) => tick));
  }
});

test("bridge celebrations are themed, valid, and use every motion", () => {
  assert.ok(BRIDGE_CELEBRATIONS.messages.length >= 5);
  assert.ok(BRIDGE_CELEBRATIONS.messages.includes("Tilly made it!"));
  assert.deepEqual(new Set(BRIDGE_CELEBRATIONS.effects.map(({ motion }) => motion)), new Set(MOTIONS));
  for (const id of ["sparkles", "pond-bubbles", "falling-leaves", "turtle-friends", "lily-blossoms", "fraction-stars", "frog-hops", "fish-splash", "duck-parade", "river-rainbows"]) {
    assert.ok(BRIDGE_CELEBRATIONS.effects.some((effect) => effect.id === id), id);
  }
  assert.ok(Object.isFrozen(BRIDGE_CELEBRATIONS));
});

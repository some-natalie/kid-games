import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, buildJourney, stepEquation, stepStory, stepHint } from "../../../static/acorn-adventure-engine.js";

function seeded(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("ten levels progress from two small steps to four steps within 100", () => {
  assert.equal(LEVELS.length, 10);
  assert.deepEqual(LEVELS.map((level) => level.steps), [2, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  assert.deepEqual(LEVELS.map((level) => level.max), [10, 10, 20, 20, 20, 30, 50, 50, 100, 100]);
  assert.deepEqual(LEVELS[2].operations, ["-", "+"]);
});

test("each step carries the exact preceding total and stays within its level bounds", () => {
  for (const random of [() => 0, () => 0.999999, ...Array.from({ length: 100 }, (_, seed) => seeded(seed))]) {
    for (const [index, level] of LEVELS.entries()) {
      const journey = buildJourney(index, random);
      assert.equal(journey.steps.length, level.steps);
      let total = journey.start;
      for (const [position, step] of journey.steps.entries()) {
        assert.equal(step.before, total);
        assert.equal(step.operation, level.operations[position]);
        assert.ok(Number.isInteger(step.amount) && step.amount > 0);
        total = step.operation === "+" ? total + step.amount : total - step.amount;
        assert.equal(step.total, total);
        assert.ok(total >= 0 && total <= level.max);
        assert.equal(step.choices.length, 4);
        assert.equal(new Set(step.choices).size, 4);
        assert.ok(step.choices.includes(total));
        assert.ok(step.choices.every((value) => Number.isInteger(value) && value >= 0 && value <= level.max));
      }
      assert.equal(journey.total, total);
    }
  }
});

test("random generation is reproducible, varied, and rejects invalid inputs", () => {
  assert.deepEqual(buildJourney(4, seeded(42)), buildJourney(4, seeded(42)));
  assert.notDeepEqual(buildJourney(4, seeded(42)), buildJourney(4, seeded(43)));
  const positions = new Set();
  for (let seed = 0; seed < 30; seed += 1) {
    for (const step of buildJourney(9, seeded(seed)).steps) positions.add(step.choices.indexOf(step.total));
  }
  assert.equal(positions.size, 4);
  for (const index of [-1, 10, 1.5, NaN, undefined, "1"]) assert.throws(() => buildJourney(index), RangeError);
  for (const value of [-1, 1, NaN, Infinity]) assert.throws(() => buildJourney(0, () => value), RangeError);
});

test("the example evaluates left to right and story hints use the carried total", () => {
  const steps = [
    { before: 5, operation: "+", amount: 4, total: 9 },
    { before: 9, operation: "-", amount: 3, total: 6 },
    { before: 6, operation: "+", amount: 6, total: 12 },
  ];
  assert.deepEqual(steps.map(stepEquation), ["5 + 4 = 9", "9 \u2212 3 = 6", "6 + 6 = 12"]);
  assert.ok(steps.every((step) => step.total <= 12));
  assert.match(stepStory(steps[1]), /Share 3.*your 9/);
  assert.match(stepHint(steps[2]), /Start with 6.*forward 6/);
});

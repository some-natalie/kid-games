import assert from "node:assert/strict";
import test from "node:test";
import { LEVELS, STEPS_PER_LEVEL, buildRound, equationText, spokenEquation, hintText } from "../../../static/number-trail-engine.js";

function seeded(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("the curriculum progresses through ten bounded arithmetic levels", () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(STEPS_PER_LEVEL, 5);
  assert.deepEqual(LEVELS.map((level) => level.max), [10, 10, 20, 20, 20, 20, 100, 100, 100, 100]);
  assert.deepEqual(LEVELS.map((level) => level.missing), [false, false, false, false, true, true, false, false, false, true]);
  assert.deepEqual(LEVELS[8].operations, ["+", "-"]);
  assert.deepEqual(LEVELS[9].operations, ["+", "-"]);
});

test("every generated round has five distinct, correct puzzles and four valid unique choices", () => {
  for (let seed = 0; seed < 100; seed += 1) {
    for (const [index, level] of LEVELS.entries()) {
      const round = buildRound(index, seeded(seed));
      assert.equal(round.length, 5);
      assert.equal(new Set(round.map((problem) => equationText(problem))).size, 5);
      for (const problem of round) {
        assert.ok(level.operations.includes(problem.operation));
        assert.equal(problem.result, problem.operation === "+" ? problem.left + problem.right : problem.left - problem.right);
        assert.equal(problem.answer, problem[problem.missing]);
        for (const value of [problem.left, problem.right, problem.result, ...problem.choices]) {
          assert.ok(Number.isInteger(value) && value >= 0 && value <= level.max);
          assert.equal(value % level.unit, 0);
        }
        assert.equal(problem.choices.length, 4);
        assert.equal(new Set(problem.choices).size, 4);
        assert.equal(problem.choices.filter((value) => value === problem.answer).length, 1);
        assert.equal(problem.missing === "result", !level.missing);
        assert.equal((equationText(problem).match(/\?/g) ?? []).length, 1);
      }
      if (level.operations.length === 2) {
        assert.deepEqual(new Set(round.map((problem) => problem.operation)), new Set(["+", "-"]));
      }
      if (level.missing) {
        assert.deepEqual(new Set(round.map((problem) => problem.missing)), new Set(["left", "right"]));
        if (level.operations.length === 2) {
          assert.deepEqual(new Set(round.map((problem) => `${problem.operation}:${problem.missing}`)),
            new Set(["+:left", "+:right", "-:left", "-:right"]));
        }
      }
    }
  }
});

test("rounds are reproducible for tests but vary across seeds, including answer positions", () => {
  assert.deepEqual(buildRound(0, seeded(42)), buildRound(0, seeded(42)));
  assert.notDeepEqual(buildRound(0, seeded(42)), buildRound(0, seeded(43)));
  const positions = new Set();
  for (let seed = 0; seed < 30; seed += 1) {
    for (const problem of buildRound(0, seeded(seed))) positions.add(problem.choices.indexOf(problem.answer));
  }
  assert.equal(positions.size, 4);
  for (const random of [() => 0, () => 0.999999]) {
    for (let level = 0; level < LEVELS.length; level += 1) assert.equal(buildRound(level, random).length, 5);
  }
});

test("invalid level indices and random values throw explicit errors", () => {
  for (const index of [-1, 10, 0.5, NaN, "0", undefined]) {
    assert.throws(() => buildRound(index), RangeError);
  }
  for (const value of [-0.1, 1, NaN, Infinity]) assert.throws(() => buildRound(0, () => value), RangeError);
});

test("equations and hints support each missing position without giving away the answer", () => {
  const base = { left: 8, right: 3, operation: "-", result: 5 };
  assert.equal(equationText({ ...base, missing: "result" }), "8 \u2212 3 = ?");
  assert.equal(equationText({ ...base, missing: "left" }), "? \u2212 3 = 5");
  assert.equal(equationText({ ...base, missing: "right" }), "8 \u2212 ? = 5");
  assert.equal(equationText({ ...base, missing: "left" }, true), "8 \u2212 3 = 5");
  assert.equal(spokenEquation({ ...base, missing: "right" }), "8 minus what number equals 5?");
  assert.match(hintText({ ...base, missing: "result" }), /count back 3/);
  assert.match(hintText({ ...base, missing: "left" }), /starting number/);
  assert.match(hintText({ ...base, missing: "right" }), /take away from 8/);
  const addition = { left: 2, right: 3, result: 5, operation: "+" };
  assert.match(hintText({ ...addition, missing: "result" }), /count forward 3/);
  assert.match(hintText({ ...addition, missing: "left" }), /from 3 to 5/);
  assert.match(hintText({ ...addition, missing: "right" }), /from 2 to 5/);
  assert.match(hintText({ left: 20, right: 30, result: 50, operation: "+", missing: "result" }), /3 jumps of 10/);
});

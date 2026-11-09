import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODES, buildProblem, buildQuizQuestions, equationText, maxForWave, progressForElapsed,
  strategyText, travelDuration,
} from "../../../static/math-meteor-patrol-engine.js";

test("arithmetic problems stay bounded and subtraction stays nonnegative", () => {
  for (const operation of ["addition", "subtraction", "multiplication"]) {
    for (let index = 0; index < 200; index += 1) {
      const problem = buildProblem(operation, 10 + index % 11);
      assert.ok(problem.left >= 0 && problem.left <= problem.max);
      assert.ok(problem.right >= 0 && problem.right <= problem.max);
      assert.ok(problem.answer >= 0 && problem.answer <= problem.max);
      assert.equal(
        problem.answer,
        operation === "addition" ? problem.left + problem.right
          : operation === "subtraction" ? problem.left - problem.right
            : problem.left * problem.right,
      );
      if (operation === "multiplication") {
        assert.ok(problem.left >= 1 && problem.right >= 1);
      }
    }
  }
});

test("difficulty ramps by one at a time and then remains within 20", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 21, 22].map(maxForWave), [10, 10, 11, 11, 12, 12, 20, 20]);
  assert.throws(() => maxForWave(0), RangeError);
});

test("practice is untimed and selectable timed modes ease into faster waves", () => {
  assert.equal(MODES.practice.duration, null);
  assert.equal(travelDuration("practice", 1), null);
  assert.equal(travelDuration("gentle", 1), 18000);
  assert.equal(travelDuration("gentle", 2), 17650);
  assert.equal(travelDuration("challenge", 1), 12000);
  assert.equal(travelDuration("challenge", 13), 9000);
  assert.equal(travelDuration("challenge", 30), 9000);
  assert.throws(() => travelDuration("unknown", 1), RangeError);
});

test("movement progress is elapsed-time based and clamped", () => {
  assert.equal(progressForElapsed(2500, 10000), 0.25);
  assert.equal(progressForElapsed(20000, 10000), 1);
  assert.throws(() => progressForElapsed(-1, 10000), RangeError);
});

test("equations and missed-answer strategies are useful for each target", () => {
  const addition = buildProblem("addition", 10, () => 0);
  const subtraction = buildProblem("subtraction", 10, () => 0.5);
  const multiplication = buildProblem("multiplication", 10, () => 0);
  assert.equal(equationText(addition), "0 + 0 = 0");
  assert.match(strategyText(addition), /count on/);
  assert.match(strategyText(subtraction), /count back/);
  assert.match(strategyText(multiplication), /groups/);
});

test("quiz questions progress from within 10 toward within 20", () => {
  const questions = buildQuizQuestions("addition", () => 0);
  assert.equal(questions.length, 11);
  assert.equal(questions[0].problem.max, 10);
  assert.equal(questions.at(-1).problem.max, 20);
  assert.equal(questions[0].prompt, `${questions[0].problem.left} + ${questions[0].problem.right} = ?`);
  assert.ok(questions.every(({ expected, problem }) => expected === problem.answer));
});

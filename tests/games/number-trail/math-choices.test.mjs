import test from "node:test";
import assert from "node:assert/strict";
import { answerChoices } from "../../../static/math-choices.js";

const sorted = (...args) => answerChoices(...args, () => 0).sort((a, b) => a - b);
test("addition distractors model forgotten carries, wrong operation, and omitted changes", () => {
  assert.deepEqual(sorted(79, 21, "+", { max: 100 }), [58, 79, 90, 100]);
  assert.deepEqual(sorted(28, 17, "+", { max: 100 }), [11, 28, 35, 45]);
});

test("subtraction distractors model borrowing and subtracting smaller digits from larger ones", () => {
  assert.deepEqual(sorted(52, 18, "-", { max: 100 }), [34, 44, 46, 70]);
});

test("cumulative distractors can use the starting basket instead of the carried total", () => {
  assert.deepEqual(sorted(24, 4, "-", { max: 30, earlierTotal: 5 }), [1, 20, 24, 28]);
});

test("all basic bounded sums and differences have four unique, bounded choices", () => {
  for (const max of [10, 20, 30, 50, 100]) {
    for (let left = 0; left <= max; left += 1) {
      for (let right = 0; right <= max; right += 1) {
        for (const operation of ["+", "-"]) {
          const answer = operation === "+" ? left + right : left - right;
          if (answer < 0 || answer > max) continue;
          const choices = answerChoices(left, right, operation, { max }, () => 0);
          assert.equal(new Set(choices).size, 4);
          assert.ok(choices.includes(answer));
          assert.ok(choices.every((value) => Number.isInteger(value) && value >= 0 && value <= max));
        }
      }
    }
  }
});

test("tens levels keep all distractors in whole jumps of ten", () => {
  for (let left = 0; left <= 100; left += 10) {
    for (let right = 0; right <= 100; right += 10) {
      for (const operation of ["+", "-"]) {
        const total = operation === "+" ? left + right : left - right;
        if (total < 0 || total > 100) continue;
        const choices = answerChoices(left, right, operation, { max: 100, unit: 10 }, () => 0);
        assert.equal(new Set(choices).size, 4);
        assert.ok(choices.every((value) => value % 10 === 0));
      }
    }
  }
});

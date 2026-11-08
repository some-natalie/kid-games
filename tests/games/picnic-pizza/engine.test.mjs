import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVELS, PUZZLES_PER_LEVEL, buildPuzzle, compareFractions, equalShares,
  equivalentFractions, fractionName, fractionText, hintText, matchesAnswer, quizQuestions,
} from "../../../static/picnic-pizza-engine.js";
import { gradeQuiz } from "../../../static/quiz-engine.js";

test("the seven age-progressive levels cover every fraction activity", () => {
  assert.equal(LEVELS.length, 7);
  assert.deepEqual(LEVELS.map((level) => level.activity),
    ["equal", "name", "build", "build", "compare", "equivalent", "complete"]);
  assert.deepEqual(LEVELS.map((level) => level.ages), ["6–7", "6–7", "6–7", "8–9", "8–9", "8–9", "8–9"]);
  assert.equal(PUZZLES_PER_LEVEL, 4);
});

test("equal and unequal shares are curated by equal integer areas", () => {
  assert.equal(equalShares([2, 2, 2]), true);
  assert.equal(equalShares([1, 3]), false);
  assert.equal(equalShares([1, 1.5]), false);
  assert.equal(equalShares([]), false);
  for (const [index, areas] of [[0, [1, 1]], [1, [1, 3]], [2, [1, 1]], [3, [1, 3]]]) {
    const puzzle = buildPuzzle(0, index);
    assert.deepEqual(puzzle.visual.areas, areas);
    assert.equal(puzzle.expected, equalShares(areas) ? "equal" : "unequal");
    assert.equal(matchesAnswer(puzzle, puzzle.expected), true);
  }
});

test("fraction names, notation, and selected counts stay synchronized", () => {
  assert.equal(fractionName(1, 2), "one half");
  assert.equal(fractionText(3, 4), "three quarters (3/4)");
  assert.equal(fractionName(2, 3), "two thirds");
  for (let turn = 0; turn < PUZZLES_PER_LEVEL; turn += 1) {
    const puzzle = buildPuzzle(1, turn);
    assert.equal(puzzle.visual.selected.length, puzzle.numerator);
    assert.equal(puzzle.visual.areas.length, puzzle.denominator);
    assert.equal(puzzle.expected, `${puzzle.numerator}/${puzzle.denominator}`);
    assert.ok(puzzle.choices.includes(puzzle.expected));
  }
});

test("building uses thirds, sixths, and eighths with unique equal-area pieces", () => {
  const denominators = new Set();
  for (let turn = 0; turn < 12; turn += 1) {
    const puzzle = buildPuzzle(3, turn);
    denominators.add(puzzle.denominator);
    assert.equal(puzzle.visual.areas.length, puzzle.denominator);
    assert.equal(equalShares(puzzle.visual.areas), true);
    assert.equal(matchesAnswer(puzzle, Array.from({ length: puzzle.expected }, (_, i) => i)), true);
  }
  assert.deepEqual(denominators, new Set([3, 6, 8]));
  const build = buildPuzzle(2, 0);
  assert.equal(matchesAnswer(build, [0]), true);
  assert.equal(matchesAnswer(build, [0, 0]), false);
  assert.equal(matchesAnswer(build, [0, 1]), false);
  assert.equal(matchesAnswer(build, [0, 1, 8]), false);
});

test("fraction comparisons and equivalence use exact integer cross-products", () => {
  assert.equal(compareFractions(1, 2, 1, 4), 1);
  assert.equal(compareFractions(2, 3, 3, 6), 1);
  assert.equal(compareFractions(3, 8, 1, 4), 1);
  assert.equal(compareFractions(2, 4, 1, 2), 0);
  assert.equal(equivalentFractions(1, 2, 4, 8), true);
  assert.equal(equivalentFractions(1, 2, 3, 4), false);
  assert.throws(() => compareFractions(1, 0, 1, 2), RangeError);
  assert.throws(() => compareFractions(3, 2, 1, 2), RangeError);
  assert.throws(() => compareFractions(Number.MAX_SAFE_INTEGER + 1, 1, 1, 2), RangeError);
  const compare = buildPuzzle(4, 0);
  assert.equal(compare.expected, "A");
  assert.equal(compareFractions(
    compare.comparison[0].numerator, compare.comparison[0].denominator,
    compare.comparison[1].numerator, compare.comparison[1].denominator,
  ), 1);
});

test("equivalence and completing-a-whole accept only exact, complete selections", () => {
  const equivalent = buildPuzzle(5);
  assert.deepEqual(equivalent.expected, ["2/4", "4/8"]);
  assert.equal(matchesAnswer(equivalent, ["4/8", "2/4"]), true);
  assert.equal(matchesAnswer(equivalent, ["2/4"]), false);
  assert.equal(matchesAnswer(equivalent, ["2/4", "4/8", "3/4"]), false);
  const complete = buildPuzzle(6);
  assert.deepEqual(complete.visual.selected, [0, 1, 2]);
  assert.equal(matchesAnswer(complete, [3]), true);
  assert.equal(matchesAnswer(complete, []), false);
  assert.equal(matchesAnswer(complete, [0]), false);
  assert.equal(matchesAnswer(complete, [0, 3]), false);
});

test("hints explain equal areas, numerator and denominator, comparing, and completing", () => {
  assert.match(hintText(buildPuzzle(0)), /same area/);
  assert.match(hintText(buildPuzzle(1)), /denominator.*numerator/);
  assert.match(hintText(buildPuzzle(2)), /top number/);
  assert.match(hintText(buildPuzzle(4)), /same size/);
  assert.match(hintText(buildPuzzle(5)), /same amount/);
  assert.match(hintText(buildPuzzle(6)), /remaining piece/);
});

test("all quiz questions cover the seven activities without ambiguous answers", () => {
  const questions = quizQuestions();
  assert.equal(questions.length, LEVELS.length);
  assert.deepEqual(new Set(questions.map((question) => question.kind)), new Set(["pizza"]));
  assert.ok(questions.every((question) => question.choices.length >= 2));
  assert.deepEqual(questions[5].expected, ["2/4", "4/8"]);
  assert.equal(questions[4].visualDescription.includes("same-size"), true);
  const grade = gradeQuiz(questions, questions.map((question) => question.expected));
  assert.equal(grade.percent, 100);
  assert.equal(gradeQuiz([questions[5]], [["2/4", "3/4"]]).correct, 0);
});

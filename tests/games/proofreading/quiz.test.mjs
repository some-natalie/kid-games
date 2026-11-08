import test from "node:test";
import assert from "node:assert/strict";
import { isQuizMode, gradeQuiz } from "../../../static/quiz-engine.js";

test("quiz mode requires the exact URL value 1", () => {
  for (const search of ["?quiz=1", "?theme=dinosaurs&quiz=1"]) assert.equal(isQuizMode(search), true);
  for (const search of ["", "?quiz=0", "?quiz=true", "?quiz=11", "?quizzes=1"]) assert.equal(isQuizMode(search), false);
});

test("quiz percentages count completely correct questions including unanswered ones", () => {
  const questions = [
    { kind: "number", expected: 4 },
    { kind: "acorn", expected: 0 },
    { kind: "alphabet", expected: ["apple", "banana"] },
    { kind: "proof", expected: ["0.1", "0.3"] },
  ];
  const grade = gradeQuiz(questions, [4, "0", ["banana", "apple"], ["0.3", "0.1"]]);
  assert.equal(grade.correct, 3);
  assert.equal(grade.percent, 75);
  assert.equal(grade.total, 4);
  assert.equal(gradeQuiz(questions, []).percent, 0);
  assert.equal(gradeQuiz(questions.slice(0, 3), [4]).percent, 33);
  assert.equal(gradeQuiz([{ expected: 0 }], [""]).correct, 0);
  assert.throws(() => gradeQuiz([], []), RangeError);
});

test("proofreading requires all mistakes and no false marks; revised responses get regraded", () => {
  const question = { kind: "proof", expected: ["a", "b"] };
  assert.equal(gradeQuiz([question], [["a"]]).percent, 0);
  assert.equal(gradeQuiz([question], [["a", "b", "c"]]).percent, 0);
  const responses = [["b", "a"]];
  assert.equal(gradeQuiz([question], responses).percent, 100);
  responses[0] = [];
  assert.equal(gradeQuiz([question], responses).percent, 0);
});

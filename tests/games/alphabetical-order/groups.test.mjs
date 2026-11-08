import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readWordBank } from "../../../static/alphabet-word-lists.js";
import {
  GROUP_LEVELS, addList, alphabetOrder, changeDepth, checkWorkspace, createWorkspace, finalWords,
  groupQuizQuestions, groupRound, removeList, reorderWord, sendList, transferWord, validWorkspace,
} from "../../../static/alphabet-groups-engine.js";
import { gradeQuiz } from "../../../static/quiz-engine.js";

const bank = readWordBank(JSON.parse(readFileSync(new URL("../../../static/words.json", import.meta.url), "utf8")));

function comparisonDepth(a, b) {
  let index = 0;
  while (index < Math.min(a.length, b.length) && a[index].toLowerCase() === b[index].toLowerCase()) index += 1;
  return index + 1;
}

test("seven group levels reach the exact first through seventh comparison positions using curated words", () => {
  assert.deepEqual(GROUP_LEVELS.map((level) => level.depth), [1, 2, 3, 4, 5, 6, 7]);
  const entries = new Map(bank.map((entry) => [entry.word, entry]));
  for (const [index, level] of GROUP_LEVELS.entries()) {
    for (let round = 0; round < 200; round += 1) {
      const words = groupRound(bank, index);
      assert.equal(words.length, level.count);
      assert.equal(new Set(words).size, level.count);
      assert.ok(words.every((word) => entries.get(word).tags.has("general") && !entries.get(word).tags.has("advanced")));
      const depths = words.flatMap((word, i) => words.slice(i + 1).map((other) => comparisonDepth(word, other)));
      assert.equal(Math.max(...depths), level.depth);
    }
  }
  assert.throws(() => groupRound(bank, -1), RangeError);
  assert.throws(() => groupRound(bank, 7), RangeError);
  assert.throws(() => groupRound(readWordBank({ groups: [{ tags: ["general"], words: ["cat"] }] }), 6));
});

test("learners create and refine their own lists, and transfers preserve their chosen order", () => {
  const words = ["cart", "cat", "car", "apple"];
  let state = createWorkspace(words);
  assert.deepEqual(state.lists[0].words, words);
  assert.equal(state.lists.length, 2);
  const original = JSON.stringify(state);
  state = addList(state, "c", 1);
  for (const word of ["cart", "cat", "car"]) state = transferWord(state, word, "group-1");
  state = changeDepth(state, "group-1", 2);
  state = addList(state, "ca", 3);
  state = addList(state, "car", 4);
  for (const word of ["cart", "car"]) state = transferWord(state, word, "group-3");
  state = transferWord(state, "cat", "group-2");
  state = reorderWord(state, "group-3", 1, 0);
  state = sendList(state, "tray");
  state = sendList(state, "group-3");
  state = sendList(state, "group-2");
  assert.deepEqual(finalWords(state), ["apple", "car", "cart", "cat"]);
  assert.deepEqual(checkWorkspace(state, words), { complete: true, correct: 4, solved: true });
  assert.equal(validWorkspace(state, words), true);
  assert.equal(JSON.stringify(createWorkspace(words)), original);
  state = transferWord(state, "car", "group-1");
  assert.equal(checkWorkspace(state, words).complete, false);
  state = removeList(state, "group-3");
  assert.equal(validWorkspace(state, words), true);
});

test("incorrect intermediate grouping is allowed, and only the assembled final list is graded", () => {
  const words = ["cat", "car", "cart"];
  let state = addList(createWorkspace(words), "My mixed list", 3);
  state = transferWord(state, "cat", "group-1");
  assert.deepEqual(checkWorkspace(state, words), { complete: false, correct: 0, solved: false });
  state = sendList(state, "group-1");
  state = sendList(state, "tray");
  assert.deepEqual(finalWords(state), words);
  assert.deepEqual(checkWorkspace(state, words), { complete: true, correct: 0, solved: false });
  assert.deepEqual(alphabetOrder(["cart", "car", "Cat"]), ["car", "cart", "Cat"]);
});

test("saved workspaces reject missing, duplicate, foreign words and malformed list metadata", () => {
  const words = ["car", "cart"];
  const state = addList(createWorkspace(words), "car", 4);
  assert.equal(validWorkspace(state, words), true);
  for (const bad of [
    null, {}, { ...state, nextId: 0 }, { ...state, nextId: 1 },
    { ...state, lists: state.lists.slice(1) },
    { ...state, lists: [...state.lists, state.lists[0]] },
    { ...state, lists: state.lists.map((list) => ({ ...list, depth: 99 })) },
    { ...state, lists: state.lists.map((list) => ({ ...list, name: "" })) },
    { ...state, lists: state.lists.map((list) => ({ ...list, words: ["car"] })) },
    { ...state, lists: state.lists.map((list) => ({ ...list, words: ["foreign"] })) },
  ]) assert.equal(validWorkspace(bad, words), false);
  assert.throws(() => checkWorkspace({}, words), RangeError);
});

test("invalid workspace operations fail explicitly and do not mutate their inputs", () => {
  const state = createWorkspace(["car", "cart"]);
  const original = JSON.stringify(state);
  for (const action of [
    () => addList(state, "", 1), () => addList(state, "a".repeat(41), 1),
    () => addList(state, "Word tray", 1), () => addList(state, "c", 0),
    () => changeDepth(state, "tray", 5), () => removeList(state, "tray"),
    () => transferWord(state, "missing", "final"), () => transferWord(state, "car", "tray"),
    () => transferWord(state, "car", "missing"), () => sendList(state, "final"),
    () => reorderWord(state, "tray", 0, 2),
    () => createWorkspace(["car", "Car"]), () => createWorkspace(["two words", "car"]),
  ]) assert.throws(action, RangeError);
  assert.equal(JSON.stringify(state), original);
  const full = addList(addList(state, "c", 1), "ca", 2);
  assert.throws(() => addList(full, "car", 3), RangeError);
  const occupied = transferWord(addList(state, "c", 1), "car", "group-1");
  assert.throws(() => removeList(occupied, "group-1"), RangeError);
});

test("group quizzes score only final order, retain revisable arrays, and explain shorter-word-first corrections", () => {
  const questions = groupQuizQuestions(bank);
  assert.equal(questions.length, 7);
  assert.ok(questions.every((question) => question.grouped && question.correction.includes("shared prefix")));
  const responses = questions.map((question) => [...question.expected]);
  responses[2].reverse();
  assert.deepEqual(
    (({ correct, total, percent }) => ({ correct, total, percent }))(gradeQuiz(questions, responses)),
    { correct: 6, total: 7, percent: 86 });
  responses[2] = [...questions[2].expected];
  assert.equal(gradeQuiz(questions, responses).percent, 100);
  responses[2] = [];
  assert.equal(gradeQuiz(questions, responses).correct, 6);
});

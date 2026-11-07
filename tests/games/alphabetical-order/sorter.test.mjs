import assert from "node:assert/strict";
import test from "node:test";
import { moveWord } from "../../../static/alphabet-sorter.mjs";

test("moving words works in both directions without changing the source or losing words", () => {
  const words = ["cat", "apple", "bee", "dog"];
  assert.deepEqual(moveWord(words, 0, 2), ["apple", "bee", "cat", "dog"]);
  assert.deepEqual(moveWord(words, 3, 0), ["dog", "cat", "apple", "bee"]);
  assert.deepEqual(moveWord(words, 2, 2), words);
  assert.deepEqual(words, ["cat", "apple", "bee", "dog"]);
});

test("out-of-range and noninteger positions fail explicitly", () => {
  for (const [from, to] of [[-1, 0], [0, 3], [3, 0], [0.5, 0], [0, NaN]]) {
    assert.throws(() => moveWord(["a", "b", "c"], from, to), RangeError);
  }
});

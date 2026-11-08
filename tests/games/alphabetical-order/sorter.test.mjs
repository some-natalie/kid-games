import assert from "node:assert/strict";
import test from "node:test";
import { moveWord, nearestPosition } from "../../../static/alphabet-sorter.js";

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

test("drops snap to the nearest row, including adjacent moves and list edges", () => {
  const centers = [40, 120, 200, 280];
  for (const [y, index] of [[-10, 0], [40, 0], [79, 0], [81, 1], [120, 1], [159, 1],
    [161, 2], [200, 2], [241, 3], [350, 3]]) {
    assert.equal(nearestPosition(centers, y), index);
  }
  assert.equal(nearestPosition([50], 100), 0);
  assert.equal(nearestPosition([50, 150, 350], 260), 2);
});

test("invalid drop geometry fails explicitly", () => {
  for (const [centers, y] of [[[], 0], [[0, NaN], 10], [[0], Infinity]]) {
    assert.throws(() => nearestPosition(centers, y), RangeError);
  }
});

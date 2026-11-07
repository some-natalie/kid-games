import test from "node:test";
import assert from "node:assert/strict";
import { pickVictory, VICTORY_SCENES } from "../../../static/alphabet-victory.js";

test("all ten unique victory scenes have equal random selection intervals", () => {
  assert.equal(VICTORY_SCENES.length, 10);
  assert.equal(new Set(VICTORY_SCENES).size, 10);
  assert.equal(VICTORY_SCENES[0], "dinosaur");
  for (const [index, scene] of VICTORY_SCENES.entries()) {
    assert.equal(pickVictory(() => index / 10), scene);
    assert.equal(pickVictory(() => (index + 0.99) / 10), scene);
  }
});

test("invalid randomness fails explicitly", () => {
  for (const value of [-0.1, 1, NaN, Infinity, "0.5"]) {
    assert.throws(() => pickVictory(() => value), RangeError);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { createLevelProgress } from "../../../static/level-progress.js";

const key = "kid-games.number-trail.progress";
const { loadProgress, saveProgress, clearProgress } = createLevelProgress(key, "Number Trail");
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
}

test("Number Trail saves, loads, and clears its own progress without changing other games", () => {
  const otherKey = "kid-games.proofreading.progress";
  const saved = storage({ [otherKey]: '{"version":1,"level":6}' });
  assert.deepEqual(loadProgress(() => saved, 10), { level: undefined, warning: "" });
  for (let level = 0; level < 10; level += 1) {
    assert.equal(saveProgress(() => saved, level), "");
    assert.deepEqual(loadProgress(() => saved, 10), { level, warning: "" });
  }
  assert.equal(clearProgress(() => saved), "");
  assert.equal(loadProgress(() => saved, 10).level, undefined);
  assert.equal(saved.getItem(otherKey), '{"version":1,"level":6}');
});

test("invalid saved states warn and start fresh", () => {
  const invalid = [null, [], {}, { version: 2, level: 1 }, { version: 1, level: -1 },
    { version: 1, level: 10 }, { version: 1, level: 1.5 }, { version: 1, level: "1" }];
  for (const value of ["bad json", ...invalid.map((item) => JSON.stringify(item))]) {
    const result = loadProgress(() => storage({ [key]: value }), 10);
    assert.equal(result.level, undefined);
    assert.match(result.warning, /start fresh/);
  }
});

test("blocked storage gives friendly warnings but unexpected programming errors are not swallowed", () => {
  const broken = () => { throw new DOMException("blocked", "SecurityError"); };
  assert.match(loadProgress(broken, 10).warning, /start fresh/);
  assert.match(saveProgress(broken, 1), /couldn't save/);
  assert.match(clearProgress(broken), /couldn't update/);
  const unexpected = () => { throw new TypeError("bug"); };
  assert.throws(() => loadProgress(unexpected, 10), TypeError);
  assert.throws(() => saveProgress(unexpected, 1), TypeError);
  assert.throws(() => clearProgress(unexpected), TypeError);
});

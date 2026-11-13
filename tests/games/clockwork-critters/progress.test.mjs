import assert from "node:assert/strict";
import test from "node:test";
import { createLevelProgress } from "../../../static/level-progress.js";

const key = "kid-games.clockwork-critters.progress";
const { loadProgress, saveProgress, clearProgress } = createLevelProgress(key, "Clockwork Critters");
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
}

test("Clockwork Critters saves, resumes, and clears only its own level progress", () => {
  const otherKey = "kid-games.number-trail.progress";
  const saved = storage({ [otherKey]: '{"version":1,"level":6}' });
  assert.deepEqual(loadProgress(() => saved, 4), { level: undefined, warning: "" });
  for (let level = 0; level < 4; level += 1) {
    assert.equal(saveProgress(() => saved, level), "");
    assert.deepEqual(loadProgress(() => saved, 4), { level, warning: "" });
  }
  assert.equal(clearProgress(() => saved), "");
  assert.equal(loadProgress(() => saved, 4).level, undefined);
  assert.equal(saved.getItem(otherKey), '{"version":1,"level":6}');
});

test("invalid or blocked progress produces warnings but does not hide storage errors", () => {
  for (const value of ["not json", '{"version":1,"level":4}', '{"version":2,"level":1}']) {
    const result = loadProgress(() => storage({ [key]: value }), 4);
    assert.equal(result.level, undefined);
    assert.match(result.warning, /start fresh/);
  }
  const blocked = () => { throw new DOMException("blocked", "SecurityError"); };
  assert.match(loadProgress(blocked, 4).warning, /start fresh/);
  assert.match(saveProgress(blocked, 1), /couldn't save/);
  assert.match(clearProgress(blocked), /couldn't update/);
});

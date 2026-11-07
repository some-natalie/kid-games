import assert from "node:assert/strict";
import test from "node:test";
import { clearProgress, loadProgress, PROGRESS_KEY, saveProgress } from "../../../static/proofreading-progress.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("saved levels round-trip and clear", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadProgress(() => storage, 10), { level: undefined, warning: "" });
  assert.equal(saveProgress(() => storage, 4), "");
  assert.deepEqual(loadProgress(() => storage, 10), { level: 4, warning: "" });
  assert.equal(clearProgress(() => storage), "");
  assert.equal(loadProgress(() => storage, 10).level, undefined);
});

test("invalid or unreadable saves start fresh with a warning", () => {
  for (const value of ["not json", JSON.stringify({ version: 1, level: 10 }), JSON.stringify({ version: 2, level: 1 })]) {
    const result = loadProgress(() => memoryStorage({ [PROGRESS_KEY]: value }), 10);
    assert.equal(result.level, undefined);
    assert.match(result.warning, /start fresh/);
  }
});

test("storage failures become friendly warnings", () => {
  const broken = { getItem() { throw new DOMException("blocked", "SecurityError"); },
    setItem() { throw new DOMException("full", "QuotaExceededError"); },
    removeItem() { throw new DOMException("blocked", "SecurityError"); } };
  assert.match(loadProgress(() => broken, 10).warning, /start fresh/);
  assert.match(saveProgress(() => broken, 1), /couldn't save/);
  assert.match(clearProgress(() => broken), /couldn't update/);
});

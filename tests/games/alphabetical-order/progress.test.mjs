import assert from "node:assert/strict";
import test from "node:test";
import { clearProgress, loadProgress, PROGRESS_KEY, saveProgress } from "../../../static/alphabet-progress.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

const valid = () => true;
const blocked = () => { throw new DOMException("Blocked for test", "SecurityError"); };

test("each theme saves, restores, and clears its own level", () => {
  const saved = storage();
  const get = () => saved;
  assert.deepEqual(loadProgress(get, "general", valid), { progress: undefined, warning: "" });
  const level = { level: 2, roundWords: ["cat", "ant"], words: ["ant", "cat"] };
  assert.equal(saveProgress(get, "general", level), "");
  assert.equal(saveProgress(get, "dinosaurs", { level: 5 }), "");
  assert.deepEqual(JSON.parse(saved.getItem(PROGRESS_KEY)), { version: 1, themes: { general: level, dinosaurs: { level: 5 } } });
  assert.deepEqual(loadProgress(get, "general", valid).progress, level);
  assert.equal(clearProgress(get, "general"), "");
  assert.deepEqual(loadProgress(get, "general", valid).progress, undefined);
  assert.deepEqual(loadProgress(get, "dinosaurs", valid).progress, { level: 5 });
});

test("malformed or invalid progress starts fresh with a warning and can be overwritten", (context) => {
  context.mock.method(console, "warn", () => {});
  const saved = storage();
  const get = () => saved;
  for (const value of ["invalid JSON", "null", "[]", '{"version":2,"themes":{}}', '{"version":1,"themes":[]}']) {
    saved.setItem(PROGRESS_KEY, value);
    assert.equal(loadProgress(get, "general", valid).progress, undefined);
    assert.match(loadProgress(get, "general", valid).warning, /start fresh/);
    assert.equal(saveProgress(get, "general", { level: 1 }), "");
    assert.deepEqual(loadProgress(get, "general", valid).progress, { level: 1 });
  }
  saveProgress(get, "general", { level: 99 });
  const result = loadProgress(get, "general", (progress) => progress.level < 10);
  assert.equal(result.progress, undefined);
  assert.match(result.warning, /start fresh/);
});

test("blocked storage reports warnings without blocking play", (context) => {
  context.mock.method(console, "warn", () => {});
  assert.match(loadProgress(blocked, "general", valid).warning, /start fresh/);
  assert.match(saveProgress(blocked, "general", { level: 1 }), /couldn't save/);
  assert.match(clearProgress(blocked, "general"), /couldn't update/);
});

test("unexpected programming errors are not hidden", () => {
  assert.throws(() => saveProgress(() => { throw new TypeError("bug"); }, "general", { level: 1 }), TypeError);
  const saved = storage();
  saveProgress(() => saved, "general", { level: 1 });
  assert.throws(() => loadProgress(() => saved, "general", () => { throw new TypeError("bug"); }), TypeError);
});

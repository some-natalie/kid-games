import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, loadPreferences, PREFERENCES_KEY, savePreferences } from "../../../static/alphabet-preferences.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

const themes = [DEFAULT_THEME, "dinosaurs", "flowers"];

test("a selected theme persists in a versioned preference without storing player data", () => {
  const saved = storage();
  assert.deepEqual(loadPreferences(() => saved, themes), { theme: DEFAULT_THEME, warning: "" });
  assert.equal(savePreferences(() => saved, "dinosaurs"), "");
  assert.deepEqual(JSON.parse(saved.getItem(PREFERENCES_KEY)), { version: 1, theme: "dinosaurs" });
  assert.deepEqual(loadPreferences(() => saved, themes), { theme: "dinosaurs", warning: "" });
  savePreferences(() => saved, DEFAULT_THEME);
  assert.equal(loadPreferences(() => saved, themes).theme, DEFAULT_THEME);
});

test("malformed, obsolete, and unknown preferences report a warning and use the default", (context) => {
  context.mock.method(console, "warn", () => {});
  const saved = storage();
  for (const value of ["invalid JSON", "null", "[]", '{"version":2,"theme":"dinosaurs"}',
    '{"version":1,"theme":"removed-theme"}', '{"version":1,"theme":42}']) {
    saved.setItem(PREFERENCES_KEY, value);
    const result = loadPreferences(() => saved, themes);
    assert.equal(result.theme, DEFAULT_THEME);
    assert.ok(result.warning);
  }
});

test("blocked storage access and exhausted quota report warnings without blocking play", (context) => {
  context.mock.method(console, "warn", () => {});
  const blocked = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  assert.ok(loadPreferences(blocked, themes).warning);
  assert.ok(savePreferences(blocked, "flowers"));
  const full = () => ({
    getItem: () => null,
    setItem: () => { throw new DOMException("Full", "QuotaExceededError"); },
  });
  assert.ok(savePreferences(full, "flowers"));
});

test("unexpected programming errors are not silently treated as storage restrictions", () => {
  const broken = () => { throw new TypeError("Unexpected bug"); };
  assert.throws(() => loadPreferences(broken, themes), TypeError);
  assert.throws(() => savePreferences(broken, "flowers"), TypeError);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_CELEBRATIONS, MOTIONS, readCelebrations } from "../../../static/alphabet-celebration.js";

const data = JSON.parse(readFileSync(new URL("../../../static/celebrations.json", import.meta.url), "utf8"));

test("celebrations.json is valid with varied effects and every motion", () => {
  const celebrations = readCelebrations(data);
  assert.ok(celebrations.messages.length >= 6);
  assert.ok(celebrations.effects.length >= 8);
  for (const id of ["sparkles", "flowers", "stars", "confetti"]) {
    assert.ok(celebrations.effects.some((effect) => effect.id === id), id);
  }
  assert.deepEqual(new Set(celebrations.effects.map((effect) => effect.motion)), new Set(MOTIONS));
});

test("the built-in fallback passes the same validation", () => {
  assert.doesNotThrow(() => readCelebrations({ version: 1, ...DEFAULT_CELEBRATIONS }));
});

test("invalid celebrations are rejected", () => {
  const effect = data.effects[0];
  for (const bad of [
    null,
    { ...data, version: 2 },
    { ...data, messages: [] },
    { ...data, messages: ["ok", 3] },
    { ...data, effects: [] },
    { ...data, effects: [effect, effect] },
    { ...data, effects: [{ ...effect, id: "Bad Id" }] },
    { ...data, effects: [{ ...effect, motion: "spin" }] },
    { ...data, effects: [{ ...effect, count: 0 }] },
    { ...data, effects: [{ ...effect, count: 151 }] },
    { ...data, effects: [{ ...effect, symbols: [], colors: [] }] },
    { ...data, effects: [{ ...effect, symbols: [""] }] },
  ]) {
    assert.throws(() => readCelebrations(bad), TypeError);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { MOTIONS, readCelebrations } from "../../../static/alphabet-celebration.js";
import { GAME_CELEBRATIONS, MIN_THEMED_REWARDS } from "../../../static/game-celebrations.js";

const content = new URL("../../../content/", import.meta.url);
const games = readdirSync(content, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/index.md`, content)))
  .map((entry) => entry.name)
  .sort();
const alphabet = readCelebrations(JSON.parse(readFileSync(new URL("../../../static/celebrations.json", import.meta.url), "utf8")));
const setFor = (game) => (game === "alphabetical-order" ? alphabet : GAME_CELEBRATIONS[game]);

test("every game has its own themed reward set", () => {
  assert.ok(games.length >= 7);
  assert.deepEqual([...Object.keys(GAME_CELEBRATIONS), "alphabetical-order"].sort(), games);
});

for (const game of games) {
  test(`${game} has at least ${MIN_THEMED_REWARDS} valid themed rewards using every motion`, () => {
    const celebrations = setFor(game);
    assert.doesNotThrow(() => readCelebrations({ version: 1, ...celebrations }));
    assert.ok(celebrations.effects.length >= MIN_THEMED_REWARDS, `${celebrations.effects.length} effects`);
    assert.ok(celebrations.messages.length >= 5);
    assert.equal(new Set(celebrations.effects.map(({ id }) => id)).size, celebrations.effects.length);
    assert.equal(new Set(celebrations.effects.map(({ label }) => label)).size, celebrations.effects.length);
    assert.deepEqual(new Set(celebrations.effects.map(({ motion }) => motion)), new Set(MOTIONS));
    assert.ok(Object.isFrozen(celebrations));
  });
}

test("game reward sets are themed differently from each other", () => {
  const sets = Object.entries(GAME_CELEBRATIONS);
  for (const [game, { effects }] of sets) {
    const ids = new Set(effects.map(({ id }) => id));
    for (const [other, { effects: others }] of sets) {
      if (other === game) continue;
      const shared = others.filter(({ id }) => ids.has(id)).length;
      assert.ok(shared <= 2, `${game} and ${other} share ${shared} effects`);
    }
  }
});

test("game UI modules celebrate with their own themed set", () => {
  const uses = {
    "acorn-adventure": "acorn-adventure.js",
    "fraction-bridge": "fraction-bridge.js",
    "number-trail": "number-trail.js",
    "picnic-pizza": "picnic-pizza.js",
    proofreading: "proofreading.js",
    "ribbon-workshop": "ribbon-workshop.js",
    "math-meteor-patrol": "math-meteor-patrol.js",
  };
  for (const [game, file] of Object.entries(uses)) {
    const source = readFileSync(new URL(`../../../static/${file}`, import.meta.url), "utf8");
    assert.match(source, /from "\.\/game-celebrations\.js"/, file);
    assert.ok(source.includes(`GAME_CELEBRATIONS["${game}"]`) || source.includes(`GAME_CELEBRATIONS.${game}`), file);
  }
  for (const file of ["alphabetical-order.js", "alphabet-groups.js"]) {
    const source = readFileSync(new URL(`../../../static/${file}`, import.meta.url), "utf8");
    assert.match(source, /celebrations\.json/, file);
    assert.match(source, /celebrate\(celebrations\)/, file);
  }
});

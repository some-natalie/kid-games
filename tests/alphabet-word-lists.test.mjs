import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readWordBank, selectWords, WORD_COUNT } from "../static/alphabet-word-lists.mjs";

const data = JSON.parse(await readFile(new URL("../static/words.json", import.meta.url), "utf8"));
const bank = readWordBank(data);

test("the bank contains about 25,000 unique entries and all requested tags", () => {
  assert.ok(bank.length >= 24500 && bank.length <= 25500, `${bank.length} unique entries`);
  assert.equal(new Set(bank.map((entry) => entry.word.toLowerCase())).size, bank.length);
  for (const tag of ["general", "two-letter-blend", "three-letter-blend", "vowel-team", "dinosaurs", "halloween"]) {
    assert.ok(bank.filter((entry) => entry.tags.has(tag)).length >= 12, tag);
  }
  assert.ok(bank.find((entry) => entry.word === "train").tags.has("two-letter-blend"));
  assert.ok(bank.find((entry) => entry.word === "train").tags.has("vowel-team"));
  assert.ok(bank.find((entry) => entry.word === "pumpkin").tags.has("general"));
  assert.ok(bank.find((entry) => entry.word === "pumpkin").tags.has("halloween"));
});

test("expanded themes have enough terms and the advanced pool stays out of elementary rounds", () => {
  for (const tag of [
    "spring", "summer", "autumn", "winter", "new-year", "valentines-day",
    "earth-day", "arbor-day", "independence-day", "labor-day", "thanksgiving",
    "birthday", "flowers", "trees", "space", "rocks", "weather", "ocean",
    "world-book-day", "world-oceans-day", "international-day-of-peace", "world-kindness-day",
    "habitats", "insects", "chemistry", "physics", "inventions", "computing",
    "robotics", "mathematics", "archaeology", "ancient-egypt", "ancient-greece",
    "ancient-rome", "medieval-history", "exploration", "fossils", "maps",
    "landforms", "visual-art", "music", "crafts", "stories", "sports", "pets",
  ]) {
    assert.ok(bank.filter((entry) => entry.tags.has(tag)).length >= 12, tag);
  }
  const advanced = bank.filter((entry) => entry.tags.has("advanced"));
  assert.ok(advanced.length > 22000);
  assert.ok(advanced.every((entry) => !entry.tags.has("general") && !entry.tags.has("dinosaurs")));
  assert.equal(bank.filter((entry) => entry.tags.has("general")).length, 1439);
  assert.equal(bank.filter((entry) => entry.tags.has("dinosaurs")).length, 84);
  assert.ok(data.sources.some((source) => source.name === "Princeton WordNet 3.0" && source.license));
});

test("scientific names and compound terms retain their spelling without accepting malformed separators", () => {
  const entries = readWordBank({ groups: [
    { tags: ["flowers"], words: ["sweet pea", "black-eyed susan", "rosa canina"] },
  ] });
  assert.equal(entries.length, 3);
  for (const word of [" sweet pea", "sweet pea ", "sweet  pea", "sweet_pea", "sweet--pea"]) {
    assert.throws(() => readWordBank({ groups: [{ tags: ["flowers"], words: [word] }] }));
  }
});

test("tag merging is case-insensitive and preserves the original spelling", () => {
  const entries = readWordBank({ groups: [
    { tags: ["general"], words: ["Bat"] },
    { tags: ["halloween"], words: ["bat"] },
  ] });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].word, "Bat");
  assert.deepEqual([...entries[0].tags], ["general", "halloween"]);
});

test("hundreds of rounds satisfy each level's exact comparison rules", () => {
  for (const mode of ["first-letter", "second-letter", "dinosaurs"]) {
    const sets = new Set();
    for (let round = 0; round < 300; round += 1) {
      const words = selectWords(bank, mode);
      assert.equal(words.length, WORD_COUNT);
      assert.equal(new Set(words).size, WORD_COUNT);
      sets.add([...words].sort().join(","));
      const tag = mode === "dinosaurs" ? "dinosaurs" : "general";
      assert.ok(words.every((word) => bank.find((entry) => entry.word === word).tags.has(tag)));
      const firstLetters = new Map();
      for (const word of words) {
        const first = word[0].toLowerCase();
        firstLetters.set(first, (firstLetters.get(first) ?? 0) + 1);
      }
      if (mode === "first-letter") {
        assert.equal(firstLetters.size, 12);
      } else if (mode === "second-letter") {
        assert.equal(firstLetters.size, 6);
        assert.ok([...firstLetters.values()].every((count) => count === 2));
        assert.equal(new Set(words.map((word) => word.slice(0, 2).toLowerCase())).size, 12);
      } else {
        assert.ok(new Set(words.map((word) => word.slice(0, 2).toLowerCase())).size < 12);
      }
    }
    assert.ok(sets.size > 290, `Too little variation for ${mode}: ${sets.size} sets`);
  }
});

test("malformed and insufficient word banks fail explicitly", () => {
  for (const value of [null, {}, { groups: [] }, { groups: [{ tags: [], words: ["cat"] }] },
    { groups: [{ tags: ["general"], words: [""] }] },
    { groups: [{ tags: ["general"], words: [42] }] }]) {
    assert.throws(() => readWordBank(value));
  }
  const smallBank = readWordBank({ groups: [{ tags: ["general", "dinosaurs"], words: ["cat"] }] });
  for (const mode of ["first-letter", "second-letter", "dinosaurs"]) {
    assert.throws(() => selectWords(smallBank, mode));
  }
  assert.throws(() => selectWords(bank, "unknown"), /Unknown/);
});

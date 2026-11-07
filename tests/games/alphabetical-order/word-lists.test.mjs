import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { playableThemes, QUEST_LEVELS, readWordBank, selectLevelWords, selectThemeWords } from "../../../static/alphabet-word-lists.js";

const data = JSON.parse(await readFile(new URL("../../../static/words.json", import.meta.url), "utf8"));
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

test("the quest has 10 levels that ramp from 4 to 12 words", () => {
  assert.equal(QUEST_LEVELS.length, 10);
  const counts = QUEST_LEVELS.map((level) => level.count);
  assert.equal(counts[0], 4);
  assert.equal(counts.at(-1), 12);
  assert.ok(counts.every((count, index) => index === 0 || count >= counts[index - 1]));
  assert.ok(QUEST_LEVELS.at(-1).dinosaurs);
  const depths = QUEST_LEVELS.map((level) => Math.max(1, ...(level.clusters ?? [])));
  assert.ok(depths.slice(0, -1).every((depth, index) => index === 0 || depth >= depths[index - 1]));
});

function sharedPrefix(first, second) {
  let length = 0;
  while (length < first.length && length < second.length &&
    first[length].toLowerCase() === second[length].toLowerCase()) length += 1;
  return length;
}

test("hundreds of rounds satisfy each level's exact comparison rules", () => {
  const entries = new Map(bank.map((entry) => [entry.word, entry]));
  for (const [index, level] of QUEST_LEVELS.entries()) {
    const sets = new Set();
    for (let round = 0; round < 300; round += 1) {
      const words = selectLevelWords(bank, level);
      assert.equal(words.length, level.count);
      assert.equal(new Set(words).size, level.count);
      sets.add([...words].sort().join(","));
      const tag = level.dinosaurs ? "dinosaurs" : "general";
      assert.ok(words.every((word) => entries.get(word).tags.has(tag)), `level ${index + 1}`);
      if (level.dinosaurs) {
        assert.ok(new Set(words.map((word) => word.slice(0, 2).toLowerCase())).size < level.count);
        continue;
      }
      assert.ok(words.every((word) => /^[a-z]+$/i.test(word)));
      const byFirst = Map.groupBy(words, (word) => word[0].toLowerCase());
      const clusters = [...byFirst.values()].filter((group) => group.length > 1);
      assert.ok([...byFirst.values()].every((group) => group.length <= 2));
      assert.deepEqual(clusters.map(([first, second]) => sharedPrefix(first, second) + 1).sort(),
        [...level.clusters].sort());
      for (const [first, second] of clusters) {
        assert.ok(Math.min(first.length, second.length) > sharedPrefix(first, second), `${first}/${second}`);
      }
    }
    assert.ok(sets.size > 250, `Too little variation for level ${index + 1}: ${sets.size} sets`);
  }
});

test("malformed and insufficient word banks fail explicitly", () => {
  for (const value of [null, {}, { groups: [] }, { groups: [{ tags: [], words: ["cat"] }] },
    { groups: [{ tags: ["general"], words: [""] }] },
    { groups: [{ tags: ["general"], words: [42] }] }]) {
    assert.throws(() => readWordBank(value));
  }
  const smallBank = readWordBank({ groups: [{ tags: ["general", "dinosaurs"], words: ["cat"] }] });
  for (const level of QUEST_LEVELS) {
    assert.throws(() => selectLevelWords(smallBank, level));
  }
  for (const count of [0, 1, 13, 4.5]) {
    assert.throws(() => selectLevelWords(bank, { count, clusters: [] }), /between 2 and 12/);
    assert.throws(() => selectThemeWords(bank, "dinosaurs", count), RangeError);
  }
});

test("every dropdown theme supports each quest level with unique curated words", () => {
  const themes = playableThemes(bank);
  assert.ok(themes.some((theme) => theme.id === "dinosaurs"));
  assert.ok(themes.some((theme) => theme.id === "flowers"));
  assert.ok(themes.some((theme) => theme.id === "halloween"));
  assert.ok(themes.some((theme) => theme.id === "winter"));
  assert.ok(!themes.some((theme) => ["general", "advanced", "wordnet", "vowel-team"].includes(theme.id)));
  for (const theme of themes) {
    for (let round = 0; round < 10; round += 1) {
      const count = QUEST_LEVELS[round].count;
      const words = selectThemeWords(bank, theme.id, count);
      assert.equal(words.length, count);
      assert.equal(new Set(words).size, count);
      assert.ok(words.every((word) => {
        const entry = bank.find((item) => item.word === word);
        return entry.tags.has(theme.id) && !entry.tags.has("advanced");
      }));
    }
  }
  assert.throws(() => selectThemeWords(bank, "unknown"), /Not enough curated/);
});

test("advanced-only and undersized themes never appear in the dropdown", () => {
  const entries = readWordBank({ groups: [
    { tags: ["tiny-theme"], words: ["cat"] },
    { tags: ["advanced", "advanced-theme"], words: Array.from({ length: 12 }, (_, index) => `word${String.fromCharCode(97 + index)}`) },
  ] });
  assert.deepEqual(playableThemes(entries), []);
  assert.throws(() => selectThemeWords(entries, "advanced-theme"), /Not enough curated/);
});

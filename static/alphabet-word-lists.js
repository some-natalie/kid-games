export const WORD_COUNT = 12;

export function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

export function readWordBank(data) {
  if (!data || !Array.isArray(data.groups) || data.groups.length === 0) {
    throw new Error("The word bank must contain tagged groups.");
  }
  const entries = new Map();
  for (const group of data.groups) {
    if (!group || !Array.isArray(group.tags) || group.tags.length === 0 ||
        !group.tags.every((tag) => typeof tag === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(tag)) ||
        !Array.isArray(group.words) || group.words.length === 0) {
      throw new Error("Each word group must have words and valid tags.");
    }
    for (const word of group.words) {
      if (typeof word !== "string" || !/^[a-z]+(?:[ -][a-z]+)*$/i.test(word)) {
        throw new Error("Word entries must contain words separated by single spaces or hyphens.");
      }
      const key = word.toLowerCase();
      if (!entries.has(key)) entries.set(key, { word, tags: new Set() });
      group.tags.forEach((tag) => entries.get(key).tags.add(tag));
    }
  }
  return [...entries.values()];
}

export function playableThemes(bank) {
  const excluded = new Set(["general", "advanced", "wordnet", "two-letter-blend", "three-letter-blend", "vowel-team"]);
  const counts = new Map();
  for (const entry of bank) {
    if (entry.tags.has("advanced")) continue;
    for (const tag of entry.tags) {
      if (!excluded.has(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts].filter(([, count]) => count >= WORD_COUNT).map(([tag]) => ({
    id: tag,
    label: tag.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
  })).sort((first, second) => first.label.localeCompare(second.label, "en"));
}

export function selectThemeWords(bank, theme, count = WORD_COUNT) {
  if (!Number.isInteger(count) || count < 2 || count > WORD_COUNT) throw new RangeError("Word count must be between 2 and 12.");
  const pool = bank.filter((entry) => !entry.tags.has("advanced") && entry.tags.has(theme));
  if (pool.length < WORD_COUNT) throw new Error(`Not enough curated words for theme: ${theme}`);
  return shuffled(pool).slice(0, count).map((entry) => entry.word);
}

function groupedBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = key(item);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

// Each cluster is two words sharing `depth - 1` letters and differing at letter `depth`.
// Words outside a cluster have unique first letters, so each level tests only its intended depth.
export const QUEST_LEVELS = [
  { count: 4, clusters: [], title: "ABC warm-up", hint: "Look at the first letter of each word." },
  { count: 5, clusters: [], title: "Five-word hop", hint: "Find the word whose first letter comes first in the alphabet." },
  { count: 6, clusters: [], title: "First-letter friends", hint: "Every word starts with a different letter." },
  { count: 7, clusters: [2], title: "Look a little closer", hint: "Two words start with the same letter. Compare their second letters!" },
  { count: 8, clusters: [2, 2], title: "Second-letter sleuth", hint: "When first letters match, the second letter decides." },
  { count: 9, clusters: [2, 2, 2], title: "Letter detective", hint: "Watch for words that start the same way." },
  { count: 10, clusters: [2, 2, 2, 2], title: "Ten-word trail", hint: "Some first letters match. Keep comparing until you find a difference." },
  { count: 11, clusters: [3, 2, 2, 2], title: "Third-letter treasure", hint: "Two words share their first two letters. Look at the third letter!" },
  { count: 12, clusters: [3, 3, 2, 2, 2, 2], title: "Twelve-word tower", hint: "Every word has a partner. Compare letters until they are different." },
  { count: 12, dinosaurs: true, title: "Dinosaur challenge", hint: "Dinosaur names can be long! Compare letters from the beginning until you find a difference." },
];

function pickCluster(words, depth) {
  const prefixes = [...groupedBy(words.filter((word) => word.length >= depth),
    (word) => word.slice(0, depth - 1).toLowerCase()).values()]
    .map((group) => [...groupedBy(group, (word) => word.slice(0, depth).toLowerCase()).values()])
    .filter((groups) => groups.length >= 2);
  if (prefixes.length === 0) return undefined;
  return shuffled(shuffled(prefixes)[0]).slice(0, 2).map((group) => shuffled(group)[0]);
}

export function selectLevelWords(bank, level) {
  if (!level || !Number.isInteger(level.count) || level.count < 2 || level.count > WORD_COUNT) {
    throw new Error("A quest level needs between 2 and 12 words.");
  }
  if (level.dinosaurs) return selectDinosaurWords(bank, level.count);
  const pool = bank.filter((entry) => entry.tags.has("general") && /^[a-z]+$/i.test(entry.word)).map((entry) => entry.word);
  const firstLetters = [...groupedBy(pool, (word) => word[0].toLowerCase()).entries()];
  const available = new Map(shuffled(firstLetters));
  const selected = [];
  for (const depth of [...level.clusters].sort((first, second) => second - first)) {
    const letter = [...available.keys()].find((key) => pickCluster(available.get(key), depth));
    if (!letter) throw new Error(`Not enough words share ${depth - 1} letters.`);
    selected.push(...pickCluster(available.get(letter), depth));
    available.delete(letter);
  }
  for (const group of available.values()) {
    if (selected.length === level.count) break;
    selected.push(shuffled(group)[0]);
  }
  if (selected.length !== level.count) throw new Error(`Not enough suitable words for ${level.count}-word level.`);
  return shuffled(selected);
}

function selectDinosaurWords(bank, count) {
  const pool = bank.filter((entry) => entry.tags.has("dinosaurs")).map((entry) => entry.word);
  const closeGroups = [...groupedBy(pool, (word) => word.slice(0, 2).toLowerCase()).values()]
    .filter((group) => group.length >= 2);
  if (closeGroups.length === 0) throw new Error("The dinosaur pool needs names with matching first two letters.");
  const pair = shuffled(shuffled(closeGroups)[0]).slice(0, 2);
  const selected = [...pair, ...shuffled(pool.filter((word) => !pair.includes(word))).slice(0, count - 2)];
  if (selected.length !== count) throw new Error("Not enough dinosaur names.");
  return shuffled(selected);
}

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

export function selectThemeWords(bank, theme) {
  const pool = bank.filter((entry) => !entry.tags.has("advanced") && entry.tags.has(theme));
  if (pool.length < WORD_COUNT) throw new Error(`Not enough curated words for theme: ${theme}`);
  return shuffled(pool).slice(0, WORD_COUNT).map((entry) => entry.word);
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

export function selectWords(bank, mode) {
  const tag = mode === "dinosaurs" ? "dinosaurs" : "general";
  const pool = bank.filter((entry) => entry.tags.has(tag)).map((entry) => entry.word);
  const firstLetters = groupedBy(pool, (word) => word[0].toLowerCase());
  let selected;
  if (mode === "first-letter") {
    selected = shuffled([...firstLetters.values()]).slice(0, WORD_COUNT)
      .map((group) => shuffled(group)[0]);
  } else if (mode === "second-letter") {
    const pairs = [...firstLetters.values()].map((group) =>
      [...groupedBy(group, (word) => word.slice(0, 2).toLowerCase()).values()],
    ).filter((groups) => groups.length >= 2);
    selected = shuffled(pairs).slice(0, WORD_COUNT / 2)
      .flatMap((groups) => shuffled(groups).slice(0, 2).map((group) => shuffled(group)[0]));
  } else if (mode === "dinosaurs") {
    const closeGroups = [...groupedBy(pool, (word) => word.slice(0, 2).toLowerCase()).values()]
      .filter((group) => group.length >= 2);
    if (closeGroups.length === 0) throw new Error("The dinosaur pool needs names with matching first two letters.");
    const pair = shuffled(shuffled(closeGroups)[0]).slice(0, 2);
    selected = [...pair, ...shuffled(pool.filter((word) => !pair.includes(word))).slice(0, WORD_COUNT - 2)];
  } else {
    throw new Error(`Unknown word selection mode: ${mode}`);
  }
  if (selected.length !== WORD_COUNT) throw new Error(`Not enough suitable words for ${mode}.`);
  return shuffled(selected);
}

import { selectLevelWords, shuffled } from "./alphabet-word-lists.js";
import { moveWord } from "./alphabet-sorter.js";

export const GROUPS_PROGRESS = "@letter-groups";
export const GROUP_LEVELS = Object.freeze([
  { count: 6, clusters: [], title: "First-letter lists", depth: 1 },
  { count: 8, clusters: [2, 2, 2], title: "Second-letter lists", depth: 2 },
  { count: 10, clusters: [3, 2, 2], title: "Third-letter lists", depth: 3 },
  { count: 10, clusters: [4, 3, 2], title: "Fourth-letter lists", depth: 4 },
  { count: 12, clusters: [5, 4, 3, 2], title: "Fifth-letter lists", depth: 5 },
  { count: 12, clusters: [6, 5, 4, 3, 2], title: "Sixth-letter lists", depth: 6 },
  { count: 12, clusters: [7, 6, 5, 4, 3, 2], title: "Seventh-letter lists", depth: 7 },
].map((level) => Object.freeze({ ...level, clusters: Object.freeze(level.clusters), allowWordEnd: true })));

export function groupRound(bank, index) {
  if (!Number.isInteger(index) || !GROUP_LEVELS[index]) throw new RangeError("Choose a letter-group level.");
  return selectLevelWords(bank.filter((entry) => !entry.tags.has("advanced")), GROUP_LEVELS[index]);
}

export function alphabetOrder(words) {
  return [...words].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function createWorkspace(words) {
  if (!Array.isArray(words) || words.length < 2 || words.length > 12 ||
      words.some((word) => typeof word !== "string" || !/^[a-z]+$/i.test(word)) ||
      new Set(words.map((word) => word.toLowerCase())).size !== words.length) {
    throw new RangeError("A workspace needs 2 to 12 unique, letters-only words.");
  }
  return { nextId: 1, lists: [
    { id: "tray", name: "Word tray", depth: 1, words: [...words] },
    { id: "final", name: "Final ABC list", depth: 1, words: [] },
  ] };
}

export function validWorkspace(state, words) {
  if (!state || !Number.isSafeInteger(state.nextId) || state.nextId < 1 ||
      !Array.isArray(state.lists) || state.lists.length < 2 || state.lists.length > words.length + 2) return false;
  const maxDepth = Math.max(...words.map((word) => word.length));
  const ids = new Set();
  const names = new Set();
  for (const list of state.lists) {
    if (!list || typeof list.id !== "string" || ids.has(list.id) ||
        typeof list.name !== "string" || !list.name.trim() || list.name.length > 40 || names.has(list.name.trim().toLowerCase()) ||
        !Number.isInteger(list.depth) || list.depth < 1 || list.depth > maxDepth ||
        !Array.isArray(list.words) || list.words.some((word) => !words.includes(word))) return false;
    if (list.id !== "tray" && list.id !== "final" &&
        (!/^group-[1-9]\d*$/.test(list.id) || Number(list.id.slice(6)) >= state.nextId)) return false;
    ids.add(list.id);
    names.add(list.name.trim().toLowerCase());
  }
  const all = state.lists.flatMap((list) => list.words);
  return ids.has("tray") && ids.has("final") && all.length === words.length &&
    new Set(all).size === all.length && words.every((word) => all.includes(word));
}

function findList(state, id) {
  const list = state.lists.find((item) => item.id === id);
  if (!list) throw new RangeError("Choose an existing working list.");
  return list;
}

function copy(state) {
  return { ...state, lists: state.lists.map((list) => ({ ...list, words: [...list.words] })) };
}

export function addList(state, name, depth) {
  const words = state.lists.flatMap((list) => list.words);
  if (state.lists.length >= words.length + 2) throw new RangeError("There are enough working lists for every word.");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 40) {
    throw new RangeError("Give the list a name of 1 to 40 characters.");
  }
  if (state.lists.some((list) => list.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new RangeError("Choose a different name for each list.");
  }
  if (!Number.isInteger(depth) || depth < 1 || depth > Math.max(...words.map((word) => word.length))) {
    throw new RangeError("Choose a letter position within these words.");
  }
  const result = copy(state);
  result.lists.splice(result.lists.length - 1, 0,
    { id: `group-${result.nextId++}`, name: name.trim(), depth, words: [] });
  return result;
}

export function removeList(state, id) {
  if (id === "tray" || id === "final" || findList(state, id).words.length) {
    throw new RangeError("Only an empty working list can be removed.");
  }
  const result = copy(state);
  result.lists = result.lists.filter((list) => list.id !== id);
  return result;
}

export function changeDepth(state, id, depth) {
  const maxDepth = Math.max(...state.lists.flatMap((list) => list.words).map((word) => word.length));
  if (!Number.isInteger(depth) || depth < 1 || depth > maxDepth) throw new RangeError("Choose a letter position within these words.");
  const result = copy(state);
  findList(result, id).depth = depth;
  return result;
}

export function transferWord(state, word, toId) {
  const result = copy(state);
  const source = result.lists.find((list) => list.words.includes(word));
  const destination = findList(result, toId);
  if (!source || source === destination) throw new RangeError("Move a word to a different list.");
  source.words.splice(source.words.indexOf(word), 1);
  destination.words.push(word);
  return result;
}

export function reorderWord(state, id, from, to) {
  const result = copy(state);
  const list = findList(result, id);
  list.words = moveWord(list.words, from, to);
  return result;
}

export function sendList(state, id) {
  if (id === "final") throw new RangeError("Choose a list to send to the final ABC list.");
  const result = copy(state);
  const source = findList(result, id);
  findList(result, "final").words.push(...source.words);
  source.words = [];
  return result;
}

export function finalWords(state) {
  return [...findList(state, "final").words];
}

export function checkWorkspace(state, words) {
  if (!validWorkspace(state, words)) throw new RangeError("Each round word must appear in exactly one list.");
  const answer = finalWords(state);
  const expected = alphabetOrder(words);
  const correct = answer.filter((word, index) => word === expected[index]).length;
  return { complete: answer.length === words.length, correct, solved: correct === words.length };
}

export function groupQuizQuestions(bank) {
  return GROUP_LEVELS.map((level, index) => {
    const words = groupRound(bank, index);
    const expected = alphabetOrder(words);
    return {
      kind: "alphabet", grouped: true, title: `Level ${index + 1}: ${level.title}`,
      initial: shuffled(words), expected,
      prompt: "Make your own working lists, arrange their words, and assemble your final ABC list. You can revise every list before submitting.",
      correction: `Correct order: ${expected.join(", ")}. Compare from the first letter, then the next differing letter; a word ending at a shared prefix comes first.`,
    };
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRound, correctedText, correctionParts, describeFix, gradeRound, MISTAKE_TYPES, parseSentence, pickVariant, tokenKey,
} from "../../../static/proofreading-engine.js";
import { LEVELS } from "../../../static/proofreading-levels.js";

test("parseSentence splits words, punctuation, spaces, and mistakes", () => {
  const { tokens, mistakes } = parseSentence("{my>My#capitalization} cat, hi.");
  assert.equal(mistakes, 1);
  assert.deepEqual(tokens.map((token) => token.kind),
    ["mistake", "space", "word", "punct", "space", "word", "punct"]);
  assert.equal(tokens[0].text, "my");
  assert.equal(tokens[0].right, "My");
  assert.equal(correctedText({ tokens }), "My cat, hi.");
});

test("deletions remain available for red strikethrough while extra spaces highlight the single replacement space", () => {
  const deletion = parseSentence("{zebrass>zebras#spelling}").tokens[0];
  assert.deepEqual(correctionParts(deletion), { before: "zebras", changed: "", after: "", removed: "s" });
  const gap = parseSentence("{  > #spacing}").tokens[0];
  assert.deepEqual(correctionParts(gap), { before: "", changed: " ", after: "", removed: "" });
});

test("parseSentence keeps correct words and their apostrophes as one target", () => {
  const { tokens } = parseSentence("They're here.");
  assert.deepEqual(tokens.map((token) => token.text), ["They're", " ", "here", "."]);
});

test("word mistakes keep the whole target and highlight only the correction", () => {
  for (const [source, wrong, right, changed] of [
    ["{birds>Birds#capitalization}", "birds", "Birds", "B"],
    ["{SunDay>Sunday#capitalization}", "SunDay", "Sunday", "d"],
    ["{dig>big#flipped}", "dig", "big", "b"],
    ["{a^bc>abc#flipped}", "abc", "abc", "b"],
    ["{freind>friend#spelling}", "freind", "friend", "ie"],
    ["{artclass>art class#spacing}", "artclass", "art class", " "],
  ]) {
    const sentence = parseSentence(source);
    const [mistake] = sentence.tokens.filter((token) => token.kind === "mistake");
    assert.equal(sentence.mistakes, 1);
    assert.equal(mistake.text, wrong);
    assert.equal(mistake.right, right);
    assert.equal(sentence.tokens.length, 1);
    assert.equal(correctedText(sentence), right);
    const parts = correctionParts(mistake);
    assert.equal(parts.changed, changed);
    assert.equal(parts.before + parts.changed + parts.after, right);
  }
});

test("missing space after punctuation targets the punctuation, not the surrounding words", () => {
  for (const mark of [",", ".", "!", "?"]) {
    const sentence = parseSentence(`{apples${mark}pears>apples${mark} pears#space-after}`);
    assert.deepEqual(sentence.tokens.map((token) => token.text), ["apples", mark, "pears"]);
    const mistake = sentence.tokens[1];
    assert.equal(mistake.right, `${mark} `);
    assert.equal(correctionParts(mistake).changed, " ");
    assert.equal(sentence.mistakes, 1);
    assert.equal(correctedText(sentence), `apples${mark} pears`);
  }
  assert.throws(() => parseSentence("{apples>pears#space-after}"), /must add one space/);
});

test("spelling and sound-alike mistakes remain selectable as words", () => {
  const sentence = parseSentence("{freind>friend#spelling} {there>their#homonym}");
  assert.equal(sentence.tokens[0].text, "freind");
  assert.equal(sentence.tokens[2].text, "there");
});

test("parseSentence supports mirrored characters, extra spaces, and removals", () => {
  const mirrored = parseSentence("{^3>3#flipped}").tokens[0];
  assert.deepEqual(mirrored.parts, [{ text: "3", mirrored: true }]);
  const gap = parseSentence("a{  > #spacing}b").tokens[1];
  assert.equal(gap.text, "  ");
  assert.equal(describeFix(gap), "Use one space here, not two.");
  const comma = parseSentence("hi{,>#comma} there").tokens.find((token) => token.kind === "mistake");
  assert.equal(describeFix(comma), "Take out the “,”.");
  assert.match(describeFix(mirrored), /mirrored/);
});

test("parseSentence rejects bad markup", () => {
  assert.throws(() => parseSentence("{a>b#nope}"), /Unknown mistake type/);
  assert.throws(() => parseSentence("{a>a#spelling}"), /matches its fix/);
  assert.throws(() => parseSentence("oops {unfinished"), /Unfinished/);
  assert.throws(() => parseSentence("{a^>a#flipped}"), /\^/);
});

test("gradeRound separates found, false alarms, and missed mistakes", () => {
  const round = buildRound({ sentences: ["{i>I#capitalization} am {hear>here#homonym}.", "All good."] });
  assert.equal(round.total, 2);
  const grade = gradeRound(round, new Set([tokenKey(0, 0), tokenKey(1, 0)]));
  assert.deepEqual(grade.found, ["0.0"]);
  assert.deepEqual(grade.falseAlarms, ["1.0"]);
  assert.equal(grade.missed, 1);
  assert.deepEqual(grade.missedBySentence, [1, 0]);
  assert.equal(grade.total, 2);
  assert.equal(grade.complete, false);
  const mistakeKeys = round.sentences[0].tokens.flatMap((token, index) =>
    token.kind === "mistake" ? [tokenKey(0, index)] : []);
  assert.equal(gradeRound(round, new Set(mistakeKeys)).complete, true);
});

const rounds = LEVELS.map((level) => level.variants.map((sentences) => buildRound({ sentences })));
const SENTENCES = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
const MISTAKES = [1, 2, 2, 3, 3, 4, 4, 5, 6, 7];

test("pickVariant chooses by the random value and stays in range", () => {
  const level = { variants: [["a"], ["b"], ["c"]] };
  assert.deepEqual(pickVariant(level, () => 0), ["a"]);
  assert.deepEqual(pickVariant(level, () => 0.5), ["b"]);
  assert.deepEqual(pickVariant(level, () => 0.999999), ["c"]);
});

test("every level has titles, hints, and plenty of distinct variants", () => {
  assert.equal(LEVELS.length, 10);
  for (const level of LEVELS) {
    assert.ok(level.title && level.hint);
    assert.ok(level.variants.length >= 10, `${level.title} has at least 10 variants`);
    assert.equal(new Set(level.variants.map((variant) => variant.join(" "))).size, level.variants.length, `${level.title} has no duplicates`);
  }
});

test("every variant keeps its level's shape", () => {
  rounds.forEach((variants, level) => {
    variants.forEach((round) => {
      const label = `level ${level + 1}: ${round.sentences.map((sentence) => correctedText(sentence)).join(" ")}`;
      assert.equal(round.sentences.length, SENTENCES[level], label);
      assert.equal(round.total, MISTAKES[level], label);
      if (level >= 6) {
        assert.ok(round.sentences.some((sentence) => sentence.mistakes === 0), `${label} has a correct sentence`);
        assert.ok(round.sentences.some((sentence) => sentence.mistakes > 0), label);
      }
    });
  });
});

test("levels ramp from one short sentence to a five-sentence paragraph", () => {
  assert.ok(MISTAKES[0] <= 2);
  const last = rounds.at(-1);
  assert.ok(last.every((round) => round.sentences.length === 5 && round.total >= 5 && round.total <= 8));
  assert.ok(SENTENCES.every((count, index) => index === 0 || count >= SENTENCES[index - 1]));
});

test("every kind of mistake appears in the game", () => {
  const used = new Set(rounds.flat().flatMap((round) => round.sentences)
    .flatMap((sentence) => sentence.tokens.filter((token) => token.kind === "mistake").map((token) => token.type)));
  assert.deepEqual([...used].sort(), Object.keys(MISTAKE_TYPES).sort());
});

test("every capitalization or flipped-character mistake keeps the full authored word or number", () => {
  for (const round of rounds.flat()) {
    for (const sentence of round.sentences) {
      for (const token of sentence.tokens) {
        if (token.type === "capitalization" || token.type === "flipped") {
          assert.match(token.text, /^[A-Za-z0-9]+$/);
          assert.equal(token.text.length, token.right.length);
          assert.equal(correctionParts(token).changed.length, 1, token.text);
        }
      }
    }
  }
});

test("corrected text is clean: capitalized, punctuated, and well spaced", () => {
  for (const round of rounds.flat()) {
    for (const sentence of round.sentences) {
      const text = correctedText(sentence);
      assert.match(text, /^[A-Z]/, text);
      assert.match(text, /[.!?]$/, text);
      assert.doesNotMatch(text, /[{}>#^]|\s{2,}|\s[,.!?]|[,.!?][A-Za-z]/, text);
      assert.ok(sentence.mistakes === 0 || sentence.tokens.some((token) => token.kind === "mistake"));
    }
  }
});

test("a variant never repeats the same mistake word twice in a level pool entry", () => {
  for (const round of rounds.flat()) {
    const wrongs = round.sentences.flatMap((sentence) => sentence.tokens.filter((token) => token.kind === "mistake").map((token) => token.text));
    const spoken = wrongs.filter((text) => /\w{4,}/.test(text));
    assert.equal(new Set(spoken).size, spoken.length);
  }
});

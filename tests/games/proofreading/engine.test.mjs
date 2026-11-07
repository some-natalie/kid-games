import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRound, correctedText, describeFix, gradeRound, MISTAKE_TYPES, parseSentence, tokenKey,
} from "../../../static/proofreading-engine.js";
import { LEVELS } from "../../../static/proofreading-levels.js";

test("parseSentence splits words, punctuation, spaces, and mistakes", () => {
  const { tokens, mistakes } = parseSentence("{my>My#capitalization} cat, hi.");
  assert.equal(mistakes, 1);
  assert.deepEqual(tokens.map((token) => token.kind), ["mistake", "space", "word", "punct", "space", "word", "punct"]);
  assert.equal(tokens[0].text, "my");
  assert.equal(tokens[0].right, "My");
  assert.equal(correctedText({ tokens }), "My cat, hi.");
});

test("parseSentence keeps apostrophes inside words", () => {
  const { tokens } = parseSentence("They're here.");
  assert.equal(tokens[0].text, "They're");
});

test("parseSentence supports mirrored characters, extra spaces, and removals", () => {
  const mirrored = parseSentence("{^3>3#flipped}").tokens[0];
  assert.deepEqual(mirrored.parts, [{ text: "3", mirrored: true }]);
  const gap = parseSentence("a{  > #spacing}b").tokens[1];
  assert.equal(gap.text, "  ");
  assert.equal(describeFix(gap), "Use one space here, not two.");
  const comma = parseSentence("hi{,>#comma} there").tokens[1];
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
  assert.equal(gradeRound(round, new Set([tokenKey(0, 0), tokenKey(0, 4)])).complete, true);
});

test("every level is well formed", () => {
  assert.equal(LEVELS.length, 10);
  for (const level of LEVELS) {
    assert.ok(level.title && level.hint);
    const round = buildRound(level);
    assert.ok(round.total >= 1, `${level.title} has mistakes`);
  }
});

test("levels ramp from one short sentence to a five-sentence paragraph", () => {
  const rounds = LEVELS.map(buildRound);
  assert.equal(rounds[0].sentences.length, 1);
  assert.ok(rounds[0].total >= 1 && rounds[0].total <= 2);
  const last = rounds.at(-1);
  assert.equal(last.sentences.length, 5);
  assert.ok(last.total >= 5 && last.total <= 8);
  assert.ok(last.sentences.some((sentence) => sentence.mistakes === 0), "some sentences are already correct");
  assert.ok(last.sentences.some((sentence) => sentence.mistakes > 0));
  rounds.reduce((previous, round) => {
    assert.ok(round.sentences.length >= previous, "sentence count never shrinks");
    return round.sentences.length;
  }, 1);
});

test("every kind of mistake appears in the game", () => {
  const used = new Set(LEVELS.flatMap((level) => buildRound(level).sentences)
    .flatMap((sentence) => sentence.tokens.filter((token) => token.kind === "mistake").map((token) => token.type)));
  assert.deepEqual([...used].sort(), Object.keys(MISTAKE_TYPES).sort());
});

test("mistakes are the only thing wrong: corrected text has no leftover markup", () => {
  for (const level of LEVELS) {
    for (const sentence of buildRound(level).sentences) {
      assert.doesNotMatch(correctedText(sentence), /[{}>#^]|\s{2,}/);
    }
  }
});

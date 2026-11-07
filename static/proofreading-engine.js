export const MISTAKE_TYPES = Object.freeze({
  capitalization: {
    label: "Capital letter",
    tip: "Sentences, names, days of the week, and the word “I” start with a capital letter. Other words use small letters.",
  },
  comma: {
    label: "Comma in the wrong spot",
    tip: "Commas separate items in a list or mark a pause. They don’t split a simple phrase in the middle.",
  },
  period: {
    label: "Period in the wrong spot",
    tip: "A period goes at the end of a sentence, not in the middle.",
  },
  spacing: {
    label: "Spacing between words",
    tip: "Leave exactly one space between words: not none, and not two.",
  },
  "space-after": {
    label: "Space after punctuation",
    tip: "Put one space after a comma or a period before the next word.",
  },
  spelling: {
    label: "Spelling",
    tip: "Sound the word out slowly, then check which letters it really uses.",
  },
  flipped: {
    label: "Flipped letter or number",
    tip: "Check that letters like b and d, and numbers, face the right way.",
  },
  homonym: {
    label: "Sound-alike word",
    tip: "Some words sound the same but mean different things, like there, their, and they’re.",
  },
});

// Authoring format: plain text with mistakes written as {wrong>right#type}.
// Inside `wrong`, a ^ mirrors the character after it, as in {^3>3#flipped}.
const MISTAKE = /\{([^{}>#]*)>([^{}>#]*)#([a-z-]+)\}/g;
const PIECE = /[^\s]|\s+/g;
const WORD_START = /^[A-Za-z0-9'’]/;

function splitMirrored(text) {
  const parts = [];
  const add = (character, mirrored) => {
    const last = parts.at(-1);
    if (last && last.mirrored === mirrored) last.text += character;
    else parts.push({ text: character, mirrored });
  };
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "^") {
      index += 1;
      if (index >= text.length) throw new SyntaxError(`A ^ must be followed by a character in "${text}".`);
      add(text[index], true);
    } else {
      add(text[index], false);
    }
  }
  return parts;
}

export function parseSentence(source) {
  const tokens = [];
  const addPlain = (text) => {
    if (/[{}]/.test(text)) throw new SyntaxError(`Unfinished mistake markup in "${source}".`);
    for (const piece of text.match(PIECE) ?? []) {
      const kind = /^\s+$/.test(piece) ? "space" : WORD_START.test(piece) ? "word" : "punct";
      tokens.push({ kind, text: piece });
    }
  };
  let last = 0;
  for (const match of source.matchAll(MISTAKE)) {
    addPlain(source.slice(last, match.index));
    const [, wrong, right, type] = match;
    if (!Object.hasOwn(MISTAKE_TYPES, type)) throw new TypeError(`Unknown mistake type "${type}".`);
    const parts = splitMirrored(wrong);
    const text = parts.map((part) => part.text).join("");
    if (text === right && !parts.some((part) => part.mirrored)) {
      throw new TypeError(`The mistake "${wrong}" matches its fix.`);
    }
    if (type === "capitalization" || type === "flipped") {
      let start = 0;
      let end = text.length;
      let rightEnd = right.length;
      const characters = parts.flatMap((part) =>
        [...part.text].map((character) => ({ text: character, mirrored: part.mirrored })));
      while (start < end && text[start] === right[start] && !characters[start].mirrored) start += 1;
      while (end > start && rightEnd > start && text[end - 1] === right[rightEnd - 1] &&
        !characters[end - 1].mirrored) {
        end -= 1;
        rightEnd -= 1;
      }
      addPlain(text.slice(0, start));
      tokens.push({
        kind: "mistake", text: text.slice(start, end),
        parts: characters.slice(start, end), right: right.slice(start, rightEnd), type,
      });
      addPlain(text.slice(end));
    } else {
      tokens.push({ kind: "mistake", text, parts, right, type });
    }
    last = match.index + match[0].length;
  }
  addPlain(source.slice(last));
  return { tokens, mistakes: tokens.filter((token) => token.kind === "mistake").length };
}

export function buildRound(level) {
  const sentences = level.sentences.map(parseSentence);
  return { sentences, total: sentences.reduce((sum, sentence) => sum + sentence.mistakes, 0) };
}

export const pickVariant = (level, random = Math.random) =>
  level.variants[Math.floor(random() * level.variants.length)];

export const tokenKey = (sentenceIndex, tokenIndex) => `${sentenceIndex}.${tokenIndex}`;

export function gradeRound(round, marked) {
  const found = [];
  const falseAlarms = [];
  const missedBySentence = round.sentences.map(() => 0);
  round.sentences.forEach((sentence, sentenceIndex) => {
    sentence.tokens.forEach((token, tokenIndex) => {
      const key = tokenKey(sentenceIndex, tokenIndex);
      if (token.kind === "mistake") {
        if (marked.has(key)) found.push(key);
        else missedBySentence[sentenceIndex] += 1;
      } else if (marked.has(key)) {
        falseAlarms.push(key);
      }
    });
  });
  const missed = missedBySentence.reduce((sum, count) => sum + count, 0);
  return { found, falseAlarms, missed, missedBySentence, total: found.length + missed,
    complete: missed === 0 && falseAlarms.length === 0 };
}

export function describeFix(token) {
  if (token.text.trim() === "") return "Use one space here, not two.";
  if (token.right === "") return `Take out the “${token.text}”.`;
  if (token.parts.some((part) => part.mirrored)) return `The “${token.text}” is mirrored. It should face the other way: “${token.right}”.`;
  return `“${token.text}” should be “${token.right}”.`;
}

export function correctedText(sentence) {
  return sentence.tokens.map((token) => (token.kind === "mistake" ? token.right : token.text)).join("");
}

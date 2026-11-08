import { test, expect } from "@playwright/test";
import { buildRound, correctedText, tokenKey } from "../../../../static/proofreading-engine.js";
import { LEVELS } from "../../../../static/proofreading-levels.js";

const progressKey = "kid-games.proofreading.progress";
const token = (page, sentence, index) => page.locator(`[data-token="${tokenKey(sentence, index)}"]`);

// The game picks a random variant per play; tests pin it to the first (or last) one.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
});

function positions(levelIndex, wanted, variant = 0) {
  const found = [];
  buildRound({ sentences: LEVELS[levelIndex].variants[variant] }).sentences.forEach((sentence, s) => sentence.tokens.forEach((item, t) => {
    if ((item.kind === "mistake") === wanted) found.push([s, t]);
  }));
  return found;
}

async function startAtLevel(page, level) {
  await page.goto("/proofreading/");
  if (level > 0) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: progressKey, value: JSON.stringify({ version: 1, level }) });
    await page.reload();
    await expect(page.locator("#start-game")).toHaveText(`Keep playing level ${level + 1}`);
  }
  await page.locator("#start-game").click();
  await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of ${LEVELS.length}`);
}

async function markMistakes(page, level, variant = 0) {
  for (const [s, t] of positions(level, true, variant)) await token(page, s, t).click();
}

test("home page lists the game and links to it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Proofreading Detectives/ }).click();
  await expect(page).toHaveURL(/\/proofreading\/$/);
  await expect(page.getByRole("heading", { name: "What is proofreading?" })).toBeVisible();
});

test("the optional example teaches whole-word marking and shows the changed letter", async ({ page }) => {
  await page.goto("/proofreading/");
  const example = page.locator("#example-text");
  await expect(example.getByRole("button")).toHaveText(["my", "cat", "naps."]);
  await page.locator("#check-example").click();
  await expect(page.locator("#example-status")).toContainText("Tap the whole word “my” only");
  const word = example.locator(".example-token").first();
  await expect(word).toHaveAccessibleName("my");
  await word.focus();
  await word.press("Space");
  await expect(word).toHaveAttribute("aria-pressed", "true");
  await word.press("Space");
  await expect(word).toHaveAttribute("aria-pressed", "false");
  await word.click();
  await page.locator("#check-example").click();
  await expect(word).toHaveText("My");
  await expect(word.locator(".proof-change")).toHaveText("M");
  await expect(page.locator("#example-status")).toContainText("You are ready to play");
  await expect(page.locator("#start-game")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
  await page.locator("#start-game").click();
  await expect(page.locator("#progress")).toContainText("0 marked · 0 fixed");
});

test("level 1 can be solved and advances", async ({ page }) => {
  await startAtLevel(page, 0);
  await expect(page.locator("#progress")).toContainText("1 mistake to find");
  await markMistakes(page, 0);
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found all 1 mistake!");
  await expect(page.locator("#fix-list li")).toHaveCount(1);
  await expect(page.locator("#fix-list")).toContainText("“my” should be “My”");
  await expect(page.locator(".proof-token").first()).toHaveText("My");
  await expect(page.locator(".proof-token").first().locator(".proof-change")).toHaveText("M");
  await expect(page.locator("#proof-text")).toContainText("My cat likes to nap in the sun.");
  await page.locator("#next-level").click();
  await expect(page.locator("#level-count")).toHaveText("Level 2 of 10");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toContain('"level":1');
});

test("checking with nothing marked asks the player to mark something", async ({ page }) => {
  await startAtLevel(page, 0);
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("Tap the words");
});

test("correct punctuation is part of the whole word target", async ({ page }) => {
  await startAtLevel(page, 0);
  const lastWord = page.locator("#proof-text .proof-token").last();
  await expect(lastWord).toHaveText("sun.");
  await expect(lastWord).toHaveAttribute("data-kind", "word");
  await expect(page.locator("#proof-text .proof-punctuation")).toHaveCount(0);
  const bounds = await lastWord.boundingBox();
  await page.mouse.click(bounds.x + bounds.width - 3, bounds.y + bounds.height / 2);
  await expect(lastWord).toHaveAttribute("aria-pressed", "true");
  await page.locator("#check-marks").click();
  await expect(lastWord).toHaveAttribute("data-result", "false");
});

test("word targets have no horizontal padding or minimum width while punctuation stays finger-sized", async ({ page }) => {
  await page.goto("/proofreading/");
  const exampleWord = page.locator("#example-text .example-token").first();
  expect(await exampleWord.evaluate((el) => getComputedStyle(el).paddingInlineStart)).toBe("0px");
  await startAtLevel(page, 4);
  const word = page.locator('#proof-text .proof-token[data-kind="word"]').first();
  await expect(word).toHaveText("I");
  const dimensions = await word.evaluate((el) => {
    const style = getComputedStyle(el);
    return { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height,
      minWidth: style.minWidth, left: style.paddingLeft, right: style.paddingRight };
  });
  expect(dimensions.minWidth).toBe("0px");
  expect(dimensions.left).toBe("0px");
  expect(dimensions.right).toBe("0px");
  expect(dimensions.width).toBeLessThan(44);
  expect(dimensions.height).toBeGreaterThanOrEqual(44);
  const punctuation = page.locator('#proof-text .proof-token[data-kind="mark"]').first();
  const bounds = await punctuation.boundingBox();
  expect(bounds.width).toBeLessThan(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await punctuation.evaluate((el) => parseFloat(getComputedStyle(el, "::before").width))).toBeGreaterThanOrEqual(44);
  await word.click();
  await expect(word).toHaveAttribute("aria-pressed", "true");
});

test("tapping any letter in birds marks the whole word and only the corrected B is emphasized", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 3 / 11; });
  await startAtLevel(page, 0);
  const word = page.locator(".proof-chunk").first().locator(".proof-token");
  await expect(word).toHaveCount(1);
  await expect(word).toHaveText("birds");
  const bounds = await word.boundingBox();
  await page.mouse.click(bounds.x + bounds.width - 8, bounds.y + bounds.height / 2);
  await expect(word).toHaveAttribute("aria-pressed", "true");
  await page.locator("#check-marks").click();
  await expect(word).toHaveText("Birds");
  await expect(word).toHaveAccessibleName("Birds, corrected. “birds” should be “Birds”.");
  await expect(word.locator(".proof-change")).toHaveText("B");
  const style = await word.locator(".proof-change").evaluate((el) => ({
    underline: getComputedStyle(el).textDecorationLine, weight: getComputedStyle(el).fontWeight,
  }));
  expect(style.underline).toBe("underline");
  expect(Number(style.weight)).toBeGreaterThanOrEqual(700);
  await expect(page.locator("#proof-text")).toHaveText("Birds sing in the morning. ");
});

test("partial corrections survive clearing marks and keyboard navigation skips them", async ({ page }) => {
  await startAtLevel(page, 3);
  const [first, mirrored, homonym] = positions(3, true);
  await token(page, ...first).click();
  await token(page, ...mirrored).click();
  await page.locator("#check-marks").click();
  await expect(token(page, ...first)).toHaveText("We");
  await expect(token(page, ...mirrored)).toHaveText("7");
  await expect(page.locator(".mirrored")).toHaveCount(0);
  await expect(page.locator("#fix-list li")).toHaveCount(2);
  await token(page, ...homonym).click();
  await page.locator("#clear-marks").click();
  await expect(token(page, ...first)).toHaveText("We");
  await expect(token(page, ...first)).toBeDisabled();
  await expect(token(page, ...homonym)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#progress")).toContainText("2 marked");
  const available = page.locator(".proof-token:enabled");
  await available.last().focus();
  await page.keyboard.press("Home");
  await expect(available.first()).toBeFocused();
  await token(page, ...homonym).click();
  await page.locator("#check-marks").click();
  await expect(token(page, ...homonym)).toHaveText("Their");
  await expect(page.locator("#feedback")).toContainText("You found all 3 mistakes!");
});

test("wrong answers show what was right, what was fine, and what is still hiding", async ({ page }) => {
  await startAtLevel(page, 1);
  const [first, second] = positions(1, true);
  const [fine] = positions(1, false);
  await token(page, ...first).click();
  await token(page, ...fine).click();
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found 1 of 2 mistakes");
  await expect(page.locator("#feedback")).toContainText("1 marked spot marked ✗ is already correct");
  await expect(page.locator("#feedback")).toContainText("1 mistake still hiding");
  await expect(token(page, ...first)).toHaveAttribute("data-result", "found");
  await expect(token(page, ...first)).toBeVisible();
  await expect(token(page, ...first).locator("del")).toHaveText(",");
  await expect(token(page, ...first)).toHaveAccessibleName("comma, removed, fixed");
  const removedStyle = await token(page, ...first).locator("del").evaluate((el) => ({
    decoration: getComputedStyle(el).textDecorationLine, color: getComputedStyle(el).color,
  }));
  expect(removedStyle.decoration).toBe("line-through");
  expect(removedStyle.color).toBe("rgb(153, 27, 27)");
  await expect(page.locator("#progress")).toContainText("1 fixed");
  await expect(token(page, ...fine)).toHaveAttribute("data-result", "false");
  await expect(token(page, ...second)).not.toHaveAttribute("data-result", /.*/);
  await expect(page.locator("#next-level")).toBeHidden();
  // Corrected marks stay fixed while other results are cleared for a retry.
  await token(page, ...fine).click();
  await expect(token(page, ...first)).toHaveAttribute("data-result", "found");
  await expect(token(page, ...first)).toBeDisabled();
  await token(page, ...second).click();
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found all 2 mistakes!");
  await expect(page.locator("#proof-text .proof-removed")).toHaveCount(2);
  await expect(page.locator("#progress")).toContainText("2 fixed");
});

test("marks can be cleared and tokens toggle", async ({ page }) => {
  await startAtLevel(page, 0);
  const [first] = positions(0, true);
  await token(page, ...first).click();
  await expect(token(page, ...first)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#progress")).toContainText("1 marked");
  await page.locator("#clear-marks").click();
  await expect(token(page, ...first)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#progress")).toContainText("0 marked");
});

test("keyboard users can move with arrow keys and mark with Space", async ({ page }) => {
  await startAtLevel(page, 0);
  const first = page.locator(".proof-token").first();
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".proof-token").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(first).toBeFocused();
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("End");
  await expect(page.locator(".proof-token").last()).toBeFocused();
});

test("mirrored characters are drawn flipped and extra spaces show as gaps", async ({ page }) => {
  await startAtLevel(page, 3);
  await expect(page.locator(".proof-token .mirrored")).toHaveCount(1);
  expect(await page.locator(".proof-token .mirrored").evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(-1, 0, 0, 1, 0, 0)");
  await page.evaluate(() => localStorage.setItem("kid-games.proofreading.progress", JSON.stringify({ version: 1, level: 2 })));
  await page.reload();
  await page.locator("#start-game").click();
  await expect(page.locator(".proof-gap")).toHaveCount(1);
  await expect(page.locator(".proof-gap")).toHaveAccessibleName("wide space between words");
  const gap = page.locator(`[data-token="${await page.locator(".proof-gap").getAttribute("data-token")}"]`);
  await expect(gap).toHaveText(" ");
  const gapStyle = await gap.evaluate((el) => ({
    width: el.getBoundingClientRect().width, border: getComputedStyle(el).borderBottomStyle,
  }));
  expect(gapStyle.width).toBeGreaterThanOrEqual(63);
  expect(gapStyle.border).not.toBe("dotted");
  await gap.click();
  await page.locator("#check-marks").click();
  await expect(gap).not.toHaveClass(/proof-gap/);
  await expect(gap).toHaveAccessibleName("single space, corrected. Use one space here, not two.");
  await expect(gap.locator(".proof-change")).toHaveText(" ");
  expect((await gap.boundingBox()).width).toBeLessThan(gapStyle.width / 2);
});

test("punctuation is naturally spaced with a wider tap zone above it and stays crossed out when removed", async ({ page, isMobile }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await startAtLevel(page, 1);
  const [first] = positions(1, true);
  const comma = token(page, ...first);
  const bounds = await comma.boundingBox();
  expect(bounds.width).toBeLessThan(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  const previous = await page.locator('#proof-text .proof-token').filter({ hasText: /^like$/ }).boundingBox();
  expect(bounds.x - (previous.x + previous.width)).toBeLessThanOrEqual(0);
  expect(bounds.y).toBeCloseTo(previous.y, 0);
  const hitWidth = await comma.evaluate((el) => parseFloat(getComputedStyle(el, "::before").width));
  expect(hitWidth).toBeGreaterThanOrEqual(44);
  const x = bounds.x + bounds.width / 2 + hitWidth / 2 - 3;
  const y = bounds.y - 4;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(comma).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".proof-token[aria-pressed=true]")).toHaveCount(1);
  await page.locator("#check-marks").click();
  await expect(comma.locator("del")).toHaveText(",");
  expect(await comma.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(254, 202, 202)");
  await token(page, ...positions(1, true)[1]).click();
  await page.locator("#clear-marks").click();
  await expect(comma).toBeVisible();
  await expect(comma).toBeDisabled();
  await expect(page.locator("#progress")).toContainText("1 fixed");
});

test("a deleted spelling letter remains red and crossed out inside the whole corrected word", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 2 / 11; });
  await startAtLevel(page, 4);
  const [, spelling] = positions(4, true, 2);
  const word = token(page, ...spelling);
  await expect(word).toHaveText("zebrass.");
  await word.click();
  await page.locator("#check-marks").click();
  await expect(word.locator("del.proof-deletion")).toHaveText("s");
  await expect(word).toHaveAccessibleName("zebras., corrected. “zebrass.” should be “zebras.”.");
  await expect(page.locator("#progress")).toContainText("1 fixed");
});

test("whole-word targets and enlarged punctuation fit small screens with OpenDyslexic", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/proofreading/");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const level of [0, 2, 4, 5, 9]) {
    await startAtLevel(page, level);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await markMistakes(page, level);
    await page.locator("#check-marks").click();
    await expect(page.locator("#feedback")).toContainText("You found all");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});

test("missing spacing after a comma is marked separately from either whole word", async ({ page }) => {
  await startAtLevel(page, 4);
  const [first] = positions(4, true);
  const comma = token(page, ...first);
  await expect(comma).toHaveText(",");
  await expect(comma).toHaveAttribute("data-kind", "mark");
  await expect(page.locator(".proof-token").filter({ hasText: /^apples$/ })).toHaveCount(1);
  await expect(page.locator(".proof-token").filter({ hasText: /^pears,$/ })).toHaveCount(1);
  await comma.click();
  await page.locator("#check-marks").click();
  await expect(comma.locator(".proof-change")).toHaveText(" ");
  await expect(page.locator("#fix-list")).toContainText("Add one space after the comma");
});

test("final level is a five-sentence paragraph and finishing it ends the case", async ({ page }) => {
  await startAtLevel(page, 9);
  await expect(page.locator(".proof-sentence")).toHaveCount(5);
  await expect(page.locator("#progress")).toContainText("7 mistakes to find");
  await markMistakes(page, 9);
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found all 7 mistakes!");
  await expect(page.locator("#finish-case")).toBeFocused();
  await page.locator("#finish-case").click();
  await expect(page.locator("#quest-complete")).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
  await page.locator("#play-again").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10");
});

test("every level can be solved by marking exactly its mistakes", async ({ page }) => {
  test.slow();
  for (let level = 0; level < LEVELS.length - 1; level += 1) {
    await startAtLevel(page, level);
    await markMistakes(page, level);
    await page.locator("#check-marks").click();
    await expect(page.locator("#feedback")).toContainText("You found all");
    await expect(page.locator("#next-level")).toBeVisible();
    const clean = buildRound({ sentences: LEVELS[level].variants[0] }).sentences.map(correctedText).join(" ");
    expect(await page.locator("#proof-text").evaluate((el) => {
      const copy = el.cloneNode(true);
      for (const removed of copy.querySelectorAll("del")) removed.remove();
      return copy.textContent;
    })).toBe(`${clean} `);
  }
});

test("each play can pick a different variant of the same level", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.999999; });
  for (const level of [0, 3, 9]) {
    const last = LEVELS[level].variants.length - 1;
    await startAtLevel(page, level);
    expect(last).toBeGreaterThan(0);
    const shown = await page.locator("#proof-text").textContent();
    const expected = buildRound({ sentences: LEVELS[level].variants[last] }).sentences
      .map((sentence) => sentence.tokens.map((item) => item.text).join("")).join(" ");
    expect(shown.replace(/\s+/g, " ").trim()).toBe(expected.replace(/\s+/g, " ").trim());
    await markMistakes(page, level, last);
    await page.locator("#check-marks").click();
    await expect(page.locator("#feedback")).toContainText("You found all");
  }
});

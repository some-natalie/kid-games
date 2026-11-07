import { test, expect } from "@playwright/test";
import { buildRound, tokenKey } from "../../../../static/proofreading-engine.js";
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

test("level 1 can be solved and advances", async ({ page }) => {
  await startAtLevel(page, 0);
  await expect(page.locator("#progress")).toContainText("1 mistake to find");
  await markMistakes(page, 0);
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found all 1 mistake!");
  await expect(page.locator("#fix-list li")).toHaveCount(1);
  await expect(page.locator("#fix-list")).toContainText("“my” should be “My”");
  await page.locator("#next-level").click();
  await expect(page.locator("#level-count")).toHaveText("Level 2 of 10");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toContain('"level":1');
});

test("checking with nothing marked asks the player to mark something", async ({ page }) => {
  await startAtLevel(page, 0);
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("Tap the words");
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
  await expect(token(page, ...fine)).toHaveAttribute("data-result", "false");
  await expect(token(page, ...second)).not.toHaveAttribute("data-result", /.*/);
  await expect(page.locator("#next-level")).toBeHidden();
  // Changing a mark clears the stale results so the player can retry.
  await token(page, ...fine).click();
  await expect(token(page, ...first)).not.toHaveAttribute("data-result", /.*/);
  await token(page, ...second).click();
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found all 2 mistakes!");
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
});

test("final level is a five-sentence paragraph and finishing it ends the case", async ({ page }) => {
  await startAtLevel(page, 9);
  await expect(page.locator(".proof-sentence")).toHaveCount(5);
  await expect(page.locator("#progress")).toContainText("7 mistakes to find");
  await markMistakes(page, 9);
  await page.locator("#check-marks").click();
  await expect(page.locator("#feedback")).toContainText("You found all 7 mistakes!");
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

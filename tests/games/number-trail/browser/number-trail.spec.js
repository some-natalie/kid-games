import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const progressKey = "kid-games.number-trail.progress";
const stones = (page) => page.locator("#answer-stones button");
async function answerToPuzzle(page) {
  const equation = await page.locator("#puzzle-heading").textContent();
  const [left, operation, right, , result] = equation.split(" ");
  if (result === "?") return operation === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
  if (left === "?") return operation === "+" ? Number(result) - Number(right) : Number(result) + Number(right);
  return operation === "+" ? Number(result) - Number(left) : Number(left) - Number(result);
}
async function solve(page, keyboard = false) {
  const value = await answerToPuzzle(page);
  const button = page.getByRole("button", { name: `Stepping stone ${value}`, exact: true });
  if (keyboard) await button.press("Enter");
  else await button.click();
  await expect(page.locator("#feedback")).toContainText("That's it!");
  await expect(page.locator("#next-step")).toBeFocused();
}
async function start(page, level = 0) {
  await page.goto("/number-trail/");
  if (level) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
}
async function audit(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("the home tile opens a worked example and keyboard-accessible untimed play", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Number Trail/ }).click();
  await expect(page).toHaveURL(/\/number-trail\/$/);
  await expect(page.getByRole("heading", { name: "For example: 2 + 3 = ?" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("There is no timer.");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.locator("#start-game").press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(stones(page)).toHaveCount(4);
  await expect(page.locator("#trail-path li.current")).toHaveCount(1);
  await expect(page.locator("#trail-path li.current .trail-bunny")).toBeVisible();
  await expect(page.locator("#trail-path li.current .trail-number")).toHaveText("1");
  await expect(page.locator(".trail-crossing .trail-bank")).toHaveCount(2);
  await expect(page.locator(".trail-bank-far")).toHaveText("🥕");
  await expect(page.locator(".trail-crossing .trail-bank").first()).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#next-step")).toBeHidden();
  await page.locator("#show-hint").press("Space");
  await expect(page.locator("#trail-hint")).toContainText("count forward");
  const value = await answerToPuzzle(page);
  const values = await stones(page).evaluateAll((buttons) => buttons.map((button) => Number(button.value)));
  await page.getByRole("button", { name: `Stepping stone ${values.find((item) => item !== value)}`, exact: true }).press("Space");
  await expect(page.locator("#feedback")).toContainText("Try another stone!");
  await expect(page.locator("#progress")).toHaveText("0 of 5 stones crossed in this level.");
  await expect(stones(page).first()).toBeEnabled();
  await solve(page, true);
  await expect(page.locator("#progress")).toHaveText("1 of 5 stones crossed in this level.");
  await expect(page.locator("#trail-path li.crossed")).toHaveCount(1);
  await expect(stones(page).first()).toBeDisabled();
  await page.locator("#next-step").press("Enter");
  await expect(page.locator("#puzzle-heading")).toBeFocused();
  await expect(page.locator("#feedback")).toBeEmpty();
  await expect(page.locator("#trail-path li.current .trail-number")).toHaveText("2");
  await expect(page.locator("#trail-path li.current .trail-bunny")).toBeVisible();
  await expect(page.locator("#trail-path li.current")).toHaveAttribute("aria-current", "step");
});

test("all 50 stones can be crossed, progress advances, and finishing waits for the player", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  for (let level = 0; level < 10; level += 1) {
    await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of 10`);
    await expect(page.locator("#level-map .done")).toHaveCount(level);
    if (level === 6 || level === 7) await expect(page.locator("#level-instructions")).toContainText("jumps of 10");
    if ([4, 5, 9].includes(level)) await expect(page.locator("#level-instructions")).toContainText("missing starting number");
    const equations = new Set();
    for (let step = 0; step < 5; step += 1) {
      const equation = await page.locator("#puzzle-heading").textContent();
      expect(equations.has(equation)).toBe(false);
      equations.add(equation);
      await solve(page);
      await expect(page.locator("#trail-path li.crossed")).toHaveCount(step + 1);
      if (step === 4 && level < 9) {
        expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
          .toEqual({ version: 1, level: level + 1 });
      }
      if (level === 9 && step === 4) {
        await page.waitForTimeout(4500);
        await expect(page.locator("#quest-complete")).toBeHidden();
        await expect(page.locator("#next-step")).toHaveText("Finish trail");
      }
      await page.locator("#next-step").click();
    }
  }
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expect(page.locator("#quest-complete")).toContainText("all 50 stepping stones");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
  await expect(page.locator(".celebration")).toBeVisible();
  expect(await page.locator(".celebration").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator("#play-again").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10");
  await expect(page.locator("#progress")).toHaveText("0 of 5 stones crossed in this level.");
});

test("a saved level resumes and a new trail resets only Number Trail progress", async ({ page }) => {
  await start(page, 4);
  await solve(page);
  await page.reload();
  await expect(page.locator("#start-game")).toHaveText("Continue level 5");
  await page.locator("#start-game").click();
  await expect(page.locator("#level-count")).toHaveText("Level 5 of 10");
  await expect(page.locator("#progress")).toHaveText("0 of 5 stones crossed in this level.");
  await page.evaluate(() => localStorage.setItem("kid-games.proofreading.progress", '{"version":1,"level":3}'));
  await page.reload();
  await page.locator("#new-quest").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10");
  expect(await page.evaluate(() => localStorage.getItem("kid-games.proofreading.progress"))).toBe('{"version":1,"level":3}');
});

test("corrupt or blocked storage warns visibly and does not prevent play", async ({ page }) => {
  await page.goto("/number-trail/");
  await page.evaluate((key) => localStorage.setItem(key, "invalid"), progressKey);
  await page.reload();
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toBeVisible();
  await solve(page);
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.reload();
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#preference-status")).toBeVisible();
  await solve(page);
});

for (const colorScheme of ["light", "dark"]) {
  test(`tutorial, hints, correct answers, and finale pass WCAG checks in ${colorScheme} mode`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/number-trail/");
    await audit(page);
    await start(page, 9);
    await page.locator("#show-hint").click();
    await audit(page);
    const answer = await answerToPuzzle(page);
    const wrong = await stones(page).evaluateAll((buttons, answer) =>
      buttons.map((button) => Number(button.value)).find((value) => value !== answer), answer);
    await page.getByRole("button", { name: `Stepping stone ${wrong}`, exact: true }).click();
    await audit(page);
    await solve(page);
    await audit(page);
    for (let step = 1; step < 5; step += 1) {
      await page.locator("#next-step").click();
      await solve(page);
    }
    await page.locator("#next-step").click();
    await audit(page);
  });
}

test("large touch targets reflow with OpenDyslexic and enlarged custom-spaced text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page, 9);
  await page.addStyleTag({ content: `
    :root { font-size: 200%; }
    p, h1, h2, h3, button, summary {
      line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;
    }
    p { margin-bottom: 2em !important; }
  ` });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of await stones(page).all()) {
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  const answer = await answerToPuzzle(page);
  const correct = page.getByRole("button", { name: `Stepping stone ${answer}`, exact: true });
  if (test.info().project.name === "touch-chromium") await correct.tap();
  else await correct.click();
  await expect(page.locator("#feedback")).toContainText("That's it!");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

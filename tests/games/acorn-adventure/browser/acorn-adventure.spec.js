import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LEVELS } from "../../../../static/acorn-adventure-engine.js";

const key = "kid-games.acorn-adventure.progress";
async function start(page, level = 0) {
  await page.goto("/acorn-adventure/");
  if (level) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })), { key, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
}
async function solve(page, keyboard = false) {
  const [left, operation, right] = (await page.locator("#step-equation").textContent()).split(" ");
  const total = operation === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
  const button = page.getByRole("button", { name: `${total} nuts`, exact: true });
  if (keyboard) await button.press("Enter");
  else await button.click();
  await expect(page.locator("#next-step")).toBeFocused();
  await expect(page.locator("#feedback")).toContainText("That's it!");
  return total;
}
async function audit(page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("home tile, worked example, keyboard steps, and retries preserve the running total", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Acorn Adventure/ }).click();
  await expect(page.locator("#tutorial")).toContainText("5 + 4 − 3 + 6 = 12");
  await expect(page.locator("#tutorial")).toContainText("equal priority");
  await expect(page.locator(".acorn-example li")).toHaveCount(3);
  for (const [index, total] of [9, 6, 12].entries()) {
    const basket = page.locator(".acorn-example li").nth(index);
    await expect(basket.locator(".acorn-example-nuts > span")).toHaveCount(total);
    await expect(basket.locator("p")).toContainText(`Your basket: ${total} nuts`);
    await expect(basket.locator(".acorn-example-nuts")).toHaveAttribute("aria-hidden", "true");
  }
  await page.locator("#start-game").press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.locator(".acorn-term.current")).toHaveCount(1);
  await page.locator("#show-hint").press("Space");
  await expect(page.locator("#hint")).toBeVisible();
  const total = await solve(page, true);
  await expect(page.locator("#basket-total")).toContainText(`${total} `);
  await expect(page.locator(".acorn-basket p")).toHaveText(`🐿️ Your basket: ${total} ${total === 1 ? "nut" : "nuts"} 🌰`);
  await expect(page.locator("#play-area .acorn-example-nuts")).toHaveCount(0);
  await expect(page.locator("#journey-log li")).toHaveCount(1);
  await page.locator("#next-step").press("Enter");
  await expect(page.locator("#step-heading")).toBeFocused();
  await expect(page.locator("#step-equation")).toHaveText(new RegExp(`^${total} `));
  const [left, operation, right] = (await page.locator("#step-equation").textContent()).split(" ");
  const answer = operation === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
  const wrong = await page.locator("#answers button").evaluateAll((buttons, answer) =>
    buttons.map((button) => Number(button.value)).find((value) => value !== answer), answer);
  await page.getByRole("button", { name: `${wrong} nuts`, exact: true }).press("Space");
  await expect(page.locator("#feedback")).toContainText("earlier steps are safe");
  await expect(page.locator("#journey-log li")).toHaveCount(1);
  await expect(page.locator("#basket-total")).toContainText(`${total} `);
  await expect(page.locator(".acorn-term.current")).toHaveAttribute("aria-current", "step");
});

test("all ten cumulative journeys carry totals, save the next level, and wait before finishing", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  for (const [level, settings] of LEVELS.entries()) {
    await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of 10`);
    for (let step = 0; step < settings.steps; step += 1) {
      const total = await solve(page);
      await expect(page.locator("#journey-log li")).toHaveCount(step + 1);
      await expect(page.locator("#basket-total")).toContainText(`${total} `);
      if (step === settings.steps - 1) {
        await expect(page.locator("#expression")).toContainText(`= ${total}`);
        if (level < 9) {
          expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key)).toEqual({ version: 1, level: level + 1 });
        } else {
          await page.waitForTimeout(4500);
          await expect(page.locator("#quest-complete")).toBeHidden();
          await expect(page.locator("#next-step")).toHaveText("Finish adventure");
        }
      }
      await page.locator("#next-step").click();
      if (step < settings.steps - 1) {
        await expect(page.locator("#step-equation")).toHaveText(new RegExp(`^${total} `));
      }
    }
  }
  await expect(page.locator("#quest-heading")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  expect(await page.locator(".celebration").evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator("#play-again").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10");
  await expect(page.locator("#journey-log li")).toHaveCount(0);
});

test("resume and restart use a separate save; corrupt and blocked storage warn without blocking play", async ({ page }) => {
  await start(page, 5);
  await solve(page);
  await page.reload();
  await expect(page.locator("#start-game")).toHaveText("Continue level 6");
  await page.evaluate(() => localStorage.setItem("kid-games.number-trail.progress", '{"version":1,"level":4}'));
  await page.locator("#new-quest").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10");
  expect(await page.evaluate(() => localStorage.getItem("kid-games.number-trail.progress"))).toBe('{"version":1,"level":4}');
  await page.evaluate((key) => localStorage.setItem(key, "bad json"), key);
  await page.reload();
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.reload();
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toBeVisible();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await solve(page);
});

for (const colorScheme of ["light", "dark"]) {
  test(`tutorial, active steps, answers, and finale pass WCAG checks in ${colorScheme}`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/acorn-adventure/");
    await audit(page);
    await start(page, 9);
    await page.locator("#show-hint").click();
    await audit(page);
    for (let step = 0; step < 4; step += 1) {
      await solve(page);
      if (step === 0) await audit(page);
      await page.locator("#next-step").click();
    }
    await audit(page);
  });
}

test("OpenDyslexic reflow, large touch targets, and completed logs fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page, 9);
  await page.addStyleTag({ content: `
    :root { font-size: 200%; }
    p, h1, h2, h3, button, li { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
    p { margin-bottom: 2em !important; }
  ` });
  await page.evaluate(() => document.fonts.ready);
  for (const button of await page.locator("#answers button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const [left, op, right] = (await page.locator("#step-equation").textContent()).split(" ");
  const answer = op === "+" ? Number(left) + Number(right) : Number(left) - Number(right);
  const button = page.getByRole("button", { name: `${answer} nuts`, exact: true });
  if (test.info().project.name === "touch-chromium") await button.tap();
  else await button.click();
  await expect(page.locator("#journey-log li")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

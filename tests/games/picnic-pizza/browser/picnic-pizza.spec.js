import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  LEVELS, PUZZLES_PER_LEVEL, buildPuzzle, fractionText, quizQuestions,
} from "../../../../static/picnic-pizza-engine.js";

const progressKey = "kid-games.picnic-pizza.progress";

async function activate(page, button, keyboard = false) {
  if (keyboard) await button.press("Enter");
  else if (test.info().project.name === "touch-chromium") await button.tap();
  else await button.click();
}

async function start(page, level = 0) {
  await page.goto("/picnic-pizza/");
  if (level) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
}

async function answer(page, levelIndex, puzzleIndex, { keyboard = false } = {}) {
  const puzzle = buildPuzzle(levelIndex, puzzleIndex);
  if (puzzle.activity === "equal") {
    const name = puzzle.expected === "equal" ? "Equal shares" : "Unequal shares";
    const choice = page.getByRole("button", { name, exact: true });
    await activate(page, choice, keyboard);
  } else if (puzzle.activity === "name") {
    const choice = page.getByRole("button", { name: fractionText(puzzle.numerator, puzzle.denominator), exact: true });
    if (keyboard) await choice.press("Space");
    else await activate(page, choice);
  } else if (puzzle.activity === "build" || puzzle.activity === "complete") {
    const pieces = puzzle.activity === "build"
      ? Array.from({ length: puzzle.expected }, (_, index) => index)
      : puzzle.expected;
    for (const piece of pieces) {
      const control = page.getByRole("button", { name: `Piece ${piece + 1} of ${puzzle.denominator}${puzzle.activity === "complete" && piece < puzzle.numerator ? ", already served" : ""}`, exact: true });
      if (keyboard && piece === pieces[0]) await control.press("Enter");
      else await activate(page, control);
    }
    await page.locator("#check-answer").click();
  } else if (puzzle.activity === "compare") {
    const part = puzzle.comparison[puzzle.expected === "A" ? 0 : 1];
    const label = `${puzzle.expected}: ${fractionText(part.numerator, part.denominator)}`;
    const choice = page.getByRole("button", { name: label, exact: true });
    await activate(page, choice, keyboard);
  } else {
    for (const fraction of puzzle.expected) {
      const choice = page.getByRole("button", { name: `${fractionText(...fraction.split("/").map(Number))}; select this fraction`, exact: true });
      await activate(page, choice, keyboard && fraction === puzzle.expected[0]);
    }
    await page.locator("#check-answer").click();
  }
  await expect(page.locator("#feedback")).toHaveClass(/success/);
  await expect(page.locator("#next-step")).toBeFocused();
}

async function audit(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("the home tile opens a worked example with skill progression and no timer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Picnic Pizza/ }).click();
  await expect(page).toHaveURL(/\/picnic-pizza\/$/);
  await expect(page.getByRole("heading", { name: "Worked example: sharing a pizza" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("denominator");
  await expect(page.locator("#tutorial")).toContainText("numerator");
  await expect(page.locator("#tutorial")).toContainText("thirds, sixths, and eighths");
  await expect(page.locator("#tutorial")).toContainText("There is no timer");
  await expect(page.locator("#tutorial")).not.toContainText(/\bages?\b/i);
  await page.locator("#start-game").press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 7");
  await expect(page.locator("#puzzle-visuals svg path")).toHaveCount(2);
  await audit(page);
});

test("unequal cuts explain the mismatch, and all seven levels can be completed with keyboard and touch controls", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);

  const first = buildPuzzle(0, 0);
  await page.getByRole("button", { name: first.expected === "equal" ? "Unequal shares" : "Equal shares", exact: true }).click();
  await expect(page.locator("#feedback")).toContainText("not match");
  await expect(page.locator("#hint")).toContainText("same area");
  await expect(page.locator("#feedback")).not.toHaveClass(/success/);
  await page.getByRole("button", { name: first.expected === "equal" ? "Equal shares" : "Unequal shares", exact: true }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("Equal shares have the same area");
  await page.locator("#next-step").click();
  await expect(page.locator("#puzzle-visuals .fraction-whole.rectangle > span")).toHaveCount(2);
  await expect(page.locator("#puzzle-visuals .fraction-whole.rectangle")).toHaveAttribute("aria-label", /unequal pieces/);
  await expect(page.locator("#puzzle-visuals .fraction-whole.rectangle > span").nth(1)).toHaveCSS("flex-grow", "0.75");

  await answer(page, 0, 1, { keyboard: true });
  await page.locator("#next-step").click();
  await answer(page, 0, 2);
  await page.locator("#next-step").click();
  await answer(page, 0, 3);
  await page.locator("#next-step").click();

  for (let levelIndex = 1; levelIndex < LEVELS.length; levelIndex += 1) {
    await expect(page.locator("#level-count")).toContainText(`Level ${levelIndex + 1} of ${LEVELS.length}`);
    for (let puzzleIndex = 0; puzzleIndex < PUZZLES_PER_LEVEL; puzzleIndex += 1) {
      if (puzzleIndex > 0) await expect(page.locator("#puzzle-heading")).toBeFocused();
      await answer(page, levelIndex, puzzleIndex, {
        keyboard: levelIndex === 2 && puzzleIndex === 0,
      });
      if (levelIndex === 6 && puzzleIndex === PUZZLES_PER_LEVEL - 1) {
        expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
          .toEqual({ version: 1, level: 6 });
      }
      await page.locator("#next-step").click();
    }
  }
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expect(page.locator("#quest-complete")).toContainText("Great sharing");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
  expect(await page.evaluate(() => document.getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator("#play-again").click();
  await expect(page.locator("#level-title")).toHaveText(LEVELS[0].title);
});

test("level progress resumes locally, preserves other games, and reports blocked storage", async ({ page }) => {
  await page.goto("/picnic-pizza/");
  await page.evaluate(() => localStorage.setItem("kid-games.number-trail.progress", '{"version":1,"level":4}'));
  await start(page, 3);
  await expect(page.locator("#level-title")).toHaveText(LEVELS[3].title);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe('{"version":1,"level":3}');
  expect(await page.evaluate(() => localStorage.getItem("kid-games.number-trail.progress"))).toBe('{"version":1,"level":4}');
  await page.reload();
  await expect(page.locator("#start-game")).toHaveText("Continue level 4");

  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.goto("/picnic-pizza/");
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await page.getByRole("button", { name: "Equal shares", exact: true }).click();
  await expect(page.locator("#feedback")).toContainText("Equal shares");
});

test("quiz answers can be revised, are graded only at submission, and never touch normal progress", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{"version":1,"level":5}'), progressKey);
  await page.goto("/?quiz=1");
  await page.getByRole("link", { name: /Picnic Pizza/ }).click();
  await expect(page).toHaveURL(/\/picnic-pizza\/\?quiz=1$/);
  await expect(page.locator("#tutorial")).toHaveCount(0);
  await expect(page.locator("#show-hint, #check-answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Level 1, question 1/ })).toBeFocused();
  await expect(page.locator(".quiz-score")).toHaveCount(0);

  await page.getByRole("button", { name: "unequal", exact: true }).click();
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await page.getByRole("button", { name: "Previous question", exact: true }).click();
  await expect(page.getByRole("button", { name: "unequal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "equal", exact: true }).click();
  await page.getByRole("button", { name: "Next question", exact: true }).click();

  for (let index = 1; index < LEVELS.length; index += 1) {
    const question = quizQuestions()[index];
    if (question.multiple) {
      for (const value of question.expected) {
        await page.getByRole("button", { name: value, exact: true }).click();
      }
      await expect(page.getByRole("button", { name: question.expected[0], exact: true }))
        .toHaveAttribute("aria-pressed", "true");
    } else {
      await page.getByRole("button", { name: question.expected, exact: true }).click();
    }
    await expect(page.locator(".quiz-score")).toHaveCount(0);
    await page.getByRole("button", { name: index === LEVELS.length - 1 ? "Review answers" : "Next question", exact: true }).click();
  }
  await page.getByRole("button", { name: "Edit question 1", exact: true }).click();
  await page.getByRole("button", { name: "unequal", exact: true }).click();
  await page.getByRole("button", { name: "Review answers", exact: true }).click();
  await expect(page.locator(".quiz-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit quiz", exact: true }).click();
  await expect(page.locator(".quiz-score")).toHaveText("86% correct (6 of 7 questions)");
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText("Your answer: unequal");
  await expect(page.locator("#quest-complete details")).toContainText("Equal shares have the same area.");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe('{"version":1,"level":5}');
  await audit(page);
});

for (const colorScheme of ["light", "dark"]) {
  test(`fraction controls and feedback pass accessibility checks in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await start(page, 5);
    await audit(page);
    await page.getByRole("button", { name: "Show hint" }).click();
    await audit(page);
    await answer(page, 5, 0);
    await audit(page);
  });
}

test("the game reflows at 320px with OpenDyslexic and enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page, 5);
  await page.addStyleTag({ content: `
    :root { font-size: 200%; }
    p, h1, h2, h3, button, summary {
      line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;
    }
  ` });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const button = page.getByRole("button", { name: /two quarters.*select this fraction/ });
  const bounds = await button.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  if (test.info().project.name === "touch-chromium") await button.tap();
  else await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

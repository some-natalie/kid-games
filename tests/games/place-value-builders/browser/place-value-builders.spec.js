import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeQuizQuestion } from "../../../../static/place-value-builders-engine.js";
import { GAME_CELEBRATIONS } from "../../../../static/game-celebrations.js";
import { cheerPattern, expectThemedCelebration } from "../../shared/celebrations.js";

const rewards = GAME_CELEBRATIONS["place-value-builders"];
const progressKey = "kid-games.place-value-builders.progress";

async function start(page, level) {
  await page.goto("/place-value-builders/");
  if (level !== undefined) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.getByRole("button", { name: /Start building|Continue level/ }).click();
}

async function audit(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
}

test("the worked example, keyboard controls, hints, and first build are accessible", async ({ page }) => {
  await page.goto("/place-value-builders/");
  await expect(page.getByRole("heading", { name: "Worked example: trade 10 ones for 1 ten" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("14 ones");
  await expect(page.locator("#tutorial")).toContainText("zero in 105");
  await expect(page.locator(".place-value-progression li")).toHaveCount(4);
  await expect(page.locator("#tutorial")).toContainText("no timer");
  await expect(page.locator("#tutorial")).not.toContainText(/\bages?\b/i);
  await audit(page);

  await page.getByRole("button", { name: "Start building" }).press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await page.getByRole("button", { name: "Check my build" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("Not quite yet");
  await expect(page.locator("#place-value-hint")).toContainText("Add six ones");
  await expect(page.locator(".celebration")).toHaveCount(0);
  const addOne = page.getByRole("button", { name: "Add one one block" });
  for (let index = 0; index < 6; index += 1) await addOne.press("Enter");
  await expect(page.locator("#number-readout")).toContainText("Number: 6");
  await page.getByRole("button", { name: "Check my build" }).press("Enter");
  await expect(page.locator("#feedback")).toHaveText(cheerPattern(rewards, "6 is 0 hundreds, 0 tens, and 6 ones."));
  await expectThemedCelebration(page, rewards);
  await expect(page.locator("#next-level")).toBeFocused();
  await audit(page);
});

test("exchanging ones for a ten and a ten back preserves the visible number", async ({ page }) => {
  await start(page, 1);
  await expect(page.locator("#number-readout")).toContainText("Number: 14");
  await page.getByRole("button", { name: "Exchange 10 ones for one ten" }).click();
  await expect(page.locator("#number-readout")).toContainText("1 ten, and 4 ones");
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#feedback")).toContainText("14 is 0 hundreds, 1 ten, and 4 ones");
  await expect(page.locator("#next-level")).toHaveText("Next level");
  await page.getByRole("button", { name: "Next level" }).click();
  await page.getByRole("button", { name: "Exchange 1 ten for 10 ones" }).click();
  await expect(page.locator("#number-readout")).toContainText("Number: 14");
  await expect(page.locator("#number-readout")).toContainText("0 tens, and 14 ones");
  await page.getByRole("button", { name: "Check my build" }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
    .toEqual({ version: 1, level: 2 });
  await expect(page.locator("#number-readout")).toHaveAttribute("role", "status");
});

test("three-digit regrouping reaches 105 without changing the total and comparisons explain place values", async ({ page }) => {
  await start(page, 5);
  const onesBundle = page.getByRole("button", { name: "Exchange 10 ones for one ten" });
  for (let index = 0; index < 10; index += 1) await onesBundle.click();
  await expect(page.locator("#number-readout")).toContainText("Number: 105");
  await page.getByRole("button", { name: "Exchange 10 tens for one hundred" }).click();
  await expect(page.locator("#number-readout")).toContainText("1 hundred, 0 tens, and 5 ones");
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#feedback")).toContainText("105 is 1 hundred, 0 tens, and 5 ones");
  await expectThemedCelebration(page, rewards);
  await audit(page);

  await start(page, 3);
  await page.getByRole("button", { name: "Choose 17" }).click();
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#feedback")).toContainText("Choose the greater quantity");
  await expect(page.locator("#place-value-hint")).toContainText("2 tens");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await page.getByRole("button", { name: "Choose 23" }).click();
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#feedback")).toContainText("23 is greater than 17");
  await expect(page.locator("#feedback")).toContainText("2 tens, while 17 has 1 ten");

  await start(page, 9);
  await page.getByRole("button", { name: "Choose 491" }).click();
  await page.getByRole("button", { name: "Check my build" }).click();
  await page.getByRole("button", { name: "Finish building" }).click();
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expectThemedCelebration(page, rewards);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
});

test("quiz keeps saved progress private, supports revisions, and grades at submission", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "normal game progress"), progressKey);
  await page.goto("/place-value-builders/?quiz=1");
  await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Check/ })).toHaveCount(0);
  await audit(page);

  const questions = Array.from({ length: 10 }, (_, index) => makeQuizQuestion(index));
  const wrong0 = questions[0].choices.find((choice) => choice.value !== questions[0].expected);
  await page.getByRole("button", { name: wrong0.label, exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  const wrong1 = questions[1].choices.find((choice) => choice.value !== questions[1].expected);
  await page.getByRole("button", { name: wrong1.label, exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  const right1 = questions[1].choices.find((choice) => choice.value === questions[1].expected);
  await page.getByRole("button", { name: right1.label, exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  for (let index = 2; index < questions.length; index += 1) {
    const correct = questions[index].choices.find((choice) => choice.value === questions[index].expected);
    await page.getByRole("button", { name: correct.label, exact: true }).click();
    await expect(page.locator(".celebration")).toHaveCount(0);
    await page.getByRole("button", { name: index === questions.length - 1 ? "Review answers" : "Next question" }).click();
  }
  await page.getByRole("button", { name: "Edit question 2" }).click();
  await expect(page.getByRole("button", { name: right1.label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("90% correct (9 of 10 questions)");
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText(wrong0.label);
  await expect(page.locator("#quest-complete details")).toContainText(questions[0].correction);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe("normal game progress");
  await audit(page);
});

test("dark mode, reduced motion, large OpenDyslexic text, and touch controls reflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await start(page, 7);
  await page.addStyleTag({ content: `
    :root { font-size: 200%; }
    p, h1, h2, h3, button, summary {
      line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;
    }
  ` });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of await page.locator("#comparison-models button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  const choice = page.getByRole("button", { name: "Choose 350" });
  if (testInfo.project.name === "touch-chromium") await choice.tap();
  else await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await audit(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("storage failures are visible and do not prevent play", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.goto("/place-value-builders/");
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await page.getByRole("button", { name: "Start building" }).click();
  await page.getByRole("button", { name: "Add one one block" }).click();
  await expect(page.locator("#number-readout")).toContainText("Number: 1");
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "Add one one block" }).click();
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#feedback")).toHaveText(cheerPattern(rewards));
});

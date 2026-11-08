import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { makeQuizQuestion } from "../../../../static/ribbon-workshop-engine.js";

const progressKey = "kid-games.ribbon-workshop.progress";

async function start(page, level) {
  await page.goto("/ribbon-workshop/");
  if (level !== undefined) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.getByRole("button", { name: /Start making ribbons|Continue level/ }).click();
}

async function addParts(page, ribbon, count, input = "click") {
  const add = page.getByRole("button", { name: `Select one more part on ribbon ${ribbon}` });
  for (let index = 0; index < count; index += 1) {
    if (input === "keyboard") await add.press("Enter");
    else if (input === "touch") await add.tap();
    else await add.click();
  }
}

async function audit(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
}

test("the worked example explains equal parts and keyboard play supports folds and selections", async ({ page }) => {
  await page.goto("/ribbon-workshop/");
  await expect(page.getByRole("heading", { name: "Worked example: show one half" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("2/4");
  await expect(page.locator("#tutorial")).toContainText("1/2");
  await expect(page.locator(".ribbon-progression li")).toHaveCount(4);
  await expect(page.locator("#tutorial")).toContainText("no timer");
  await audit(page);

  await page.getByRole("button", { name: "Start making ribbons" }).press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 9 · Ages 6–7");
  await page.getByRole("button", { name: "Select one more part on ribbon 1" }).press("Space");
  await expect(page.locator(".ribbon-quantity")).toContainText("1/2");
  await page.getByRole("button", { name: "Check the ribbons" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("That's it! 1/2");
  await expect(page.locator("#next-level")).toBeFocused();
  await page.locator("#next-level").press("Enter");
  await expect(page.locator("#level-count")).toContainText("Level 2 of 9");
});

test("folding into eighths, equivalent selections, and the aligned overlay show matching lengths", async ({ page }) => {
  await start(page, 5);
  await expect(page.locator("#level-title")).toHaveText("Match halves and eighths");
  await page.getByRole("button", { name: "Fold ribbon 2 into 8 equal parts" }).click();
  await addParts(page, 1, 1);
  await addParts(page, 2, 4);
  await expect(page.locator(".ribbon-quantity").nth(0)).toContainText("1/2");
  await expect(page.locator(".ribbon-quantity").nth(1)).toContainText("4/8");
  await page.getByRole("button", { name: "Show aligned overlay" }).click();
  await expect(page.locator("#overlay-visual")).toBeVisible();
  await expect(page.locator("#overlay-description")).toContainText("same whole length");
  const selectedStarts = await page.locator("#overlay-visual rect[fill^='url']").evaluateAll((rectangles) =>
    rectangles.map((rectangle) => [rectangle.getAttribute("x"), rectangle.getAttribute("width")]));
  expect(selectedStarts[0][0]).toBe("0");
  expect(selectedStarts[1][0]).toBe("0");
  await audit(page);
  await page.getByRole("button", { name: "Check the ribbons" }).click();
  await expect(page.locator("#feedback")).toContainText("same length");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
    .toEqual({ version: 1, level: 5 });
});

test("wrong selections get a hint and unlimited retries; comparisons and completing a whole work", async ({ page }) => {
  await start(page, 7);
  await addParts(page, 1, 3);
  await addParts(page, 2, 1);
  await page.getByRole("button", { name: "Show aligned overlay" }).click();
  await page.getByRole("button", { name: "Check the ribbons" }).click();
  await expect(page.locator("#feedback")).toContainText("Not quite yet");
  await expect(page.locator("#ribbon-hint")).toContainText("Compare the ends");
  await audit(page);
  await page.getByRole("button", { name: "Select one more part on ribbon 2" }).click();
  await page.getByRole("button", { name: "Check the ribbons" }).click();
  await expect(page.locator("#feedback")).toContainText("3/4 is longer than 2/3");
  await page.getByRole("button", { name: "Next level" }).click();
  await expect(page.locator("#level-title")).toHaveText("Complete the whole");
  await expect(page.locator(".ribbon-quantity").first()).toContainText("5/8");
  await addParts(page, 2, 3);
  await page.getByRole("button", { name: "Check the ribbons" }).click();
  await expect(page.locator("#feedback")).toContainText("completes one whole");
  await page.getByRole("button", { name: "Finish workshop" }).click();
  await expect(page.locator("#quest-heading")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
});

test("quiz keeps progress untouched, allows revisions, and grades only after submission", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "normal game progress"), progressKey);
  await page.goto("/ribbon-workshop/?quiz=1");
  await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Check/ })).toHaveCount(0);
  await audit(page);

  const questions = Array.from({ length: 9 }, (_, index) => makeQuizQuestion(index));
  const wrong0 = questions[0].choices.find((choice) => choice.value !== questions[0].expected);
  await page.getByRole("button", { name: wrong0.label, exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  const wrong1 = questions[1].choices.find((choice) => choice.value !== questions[1].expected);
  await page.getByRole("button", { name: wrong1.label, exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("button", { name: wrong1.label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: questions[1].choices.find((choice) => choice.value === questions[1].expected).label, exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  for (let index = 2; index < questions.length; index += 1) {
    const correct = questions[index].choices.find((choice) => choice.value === questions[index].expected);
    await page.getByRole("button", { name: correct.label, exact: true }).click();
    await page.getByRole("button", { name: index === questions.length - 1 ? "Review answers" : "Next question" }).click();
  }
  await expect(page.locator(".quiz-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit question 1" }).click();
  await expect(page.getByRole("button", { name: wrong0.label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("89% correct (8 of 9 questions)");
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText(wrong0.label);
  await expect(page.locator("#quest-complete details")).toContainText("Select 1/2");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe("normal game progress");
  await audit(page);
});

test("reduced motion, dark mode, large OpenDyslexic text, and touch controls reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
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
  for (const button of await page.locator(".ribbon-fold-button, .ribbon-select-controls button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Fold ribbon 2 into 8 equal parts" }).click();
  await addParts(page, 1, 1, test.info().project.name === "touch-chromium" ? "touch" : "click");
  await expect(page.locator(".ribbon-quantity").first()).toContainText("1/2");
  await page.getByRole("button", { name: "Show aligned overlay" }).click();
  await audit(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("storage failures are visible and do not prevent selecting fractions", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.goto("/ribbon-workshop/");
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await page.getByRole("button", { name: "Start making ribbons" }).click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await addParts(page, 1, 1);
  await page.getByRole("button", { name: "Check the ribbons" }).click();
  await expect(page.locator("#feedback")).toContainText("That's it!");
});

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const progressKey = "kid-games.fraction-bridge.progress";
const start = async (page, level = 0) => {
  await page.goto("/fraction-bridge/");
  if (level) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
};
const audit = async (page) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
};

test("the worked example explains intervals and placement works with keyboard retries", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Fraction Bridge/ }).click();
  await expect(page).toHaveURL(/\/fraction-bridge\/$/);
  await expect(page.getByRole("heading", { name: "Worked example: find one half" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("denominator tells how many equal intervals");
  await expect(page.locator("#tutorial")).toContainText("There is no timer");
  await page.locator("#start-game").press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.locator("#challenge-area .fraction-position")).toHaveCount(3);
  await expect(page.locator(".fraction-line-tick")).toHaveCount(3);
  await page.getByRole("button", { name: "Position 0 (zero) on the number line" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("not the right position yet");
  await page.getByRole("button", { name: "Position 1/2 (one half) on the number line" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("1/2 (one half) belongs at 1/2");
  await expect(page.locator("#next-level")).toBeFocused();
  await page.locator("#next-level").press("Enter");
  await expect(page.locator("#level-count")).toHaveText("Level 2 of 8");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
    .toEqual({ version: 1, level: 1 });
});

test("equivalent fractions share one point and ordering uses keyboard controls", async ({ page }) => {
  await start(page, 4);
  await expect(page.locator("#level-title")).toHaveText("Share a stepping stone");
  await expect(page.locator("#challenge-area .fraction-position")).toHaveCount(9);
  await page.getByRole("button", { name: "Position 1/2 (one half) on the number line" }).click();
  await expect(page.locator("#feedback")).toContainText("1/2 (one half) and 2/4 (two fourths) share 1/2");
  await page.locator("#next-level").click();
  await expect(page.locator("#level-title")).toHaveText("Order the stepping stones");
  await page.getByRole("button", { name: "Move 2/3 down" }).press("Enter");
  await page.getByRole("button", { name: "Check order" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("1/4 (one fourth), 2/3 (two thirds), 5/6 (five sixths) are in order");
  await page.locator("#next-level").click();
  await expect(page.locator("#level-title")).toHaveText("Which is greater?");
  await page.getByRole("button", { name: "3/8 (three eighths)" }).click();
  await expect(page.locator("#feedback")).toContainText("not greater yet");
  await page.getByRole("button", { name: "5/8 (five eighths)" }).click();
  await expect(page.locator("#feedback")).toContainText("5/8 (five eighths) is greater");
});

test("the optional hint restores hidden partitions and keeps storage failures visible", async ({ page }) => {
  await start(page, 7);
  await expect(page.locator(".fraction-line-tick")).toHaveCount(2);
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.locator(".fraction-line-tick")).toHaveCount(9);
  await expect(page.locator("#fraction-hint")).toContainText("denominator");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.reload();
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#preference-status")).toBeVisible();
});

test("quiz revisions, ordering, exact results, and saved normal progress stay separate", async ({ page }) => {
  const savedProgress = '{"version":1,"level":3}';
  await page.goto(`/fraction-bridge/?quiz=1`);
  await page.evaluate((value) => localStorage.setItem("kid-games.fraction-bridge.progress", value), savedProgress);
  await page.reload();
  await expect(page.locator(".quiz-notice")).toContainText("change your answers as often as you like");
  await expect(page.locator("#tutorial")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "← All games" })).toHaveAttribute("href", /[?&]quiz=1/);
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByRole("heading", { name: "Find one half" })).toBeFocused();
  await page.getByRole("button", { name: "Position 1/2 (one half) on the number line" }).click();
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("button", { name: "Position 1/2 (one half) on the number line" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Position 1/2 (one half) on the number line" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Position 1/3 (one third) on the number line" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "2/4 (two fourths)" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "5/8 (five eighths)" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Move 1/4 up" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await expect(page.locator(".quiz-review")).toContainText("1/2");
  await page.getByRole("button", { name: "Edit question 6" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("100% correct (6 of 6 questions)");
  await expect(page.locator("#quest-complete")).toContainText("Answer details");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe(savedProgress);
});

for (const colorScheme of ["light", "dark"]) {
  test(`fraction controls pass accessibility checks in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/fraction-bridge/");
    await audit(page);
    await start(page);
    await page.getByRole("button", { name: "Show hint" }).click();
    await audit(page);
  });
}

test("position controls reflow at phone width with OpenDyslexic and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const choice of await page.locator("#challenge-area .fraction-position").all()) {
    const bounds = await choice.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator(".fraction-line").evaluate((line) => getComputedStyle(line).animationName)).toBe("none");
});

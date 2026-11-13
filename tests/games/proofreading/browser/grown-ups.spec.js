import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const license = readFileSync(new URL("../../../../LICENSE", import.meta.url), "utf8");

for (const mode of ["", "?quiz=1"]) {
  test(`all screens omit age recommendations in ${mode ? "quiz" : "normal"} mode`, async ({ page }) => {
    test.slow();
    const ageRecommendation = /\bages?\s*:?\s*\d|\b(?:under|over)\s+\d+\s*(?:years?|years?\s+old)?\b|\b\d+(?:\s*[–-]\s*\d+)?\s*[- ]year[- ]olds?\b/i;
    await page.goto(`/${mode}`);
    const gamePaths = await page.locator(".game-tile").evaluateAll((tiles) =>
      tiles.map((tile) => new URL(tile.href).pathname));
    for (const path of ["/", "/for-grown-ups/", ...gamePaths]) {
      await page.goto(`${path}${mode}`);
      await expect(page.locator("body")).not.toContainText(ageRecommendation);
      if (gamePaths.includes(path)) {
        if (mode) await page.getByRole("button", { name: "Start quiz", exact: true }).click();
        else await page.locator("#start-game").click();
        await expect(page.locator("body")).not.toContainText(ageRecommendation);
      }
    }
  });
}

test("landing page links to grown-up settings without listing them as a game", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-tile")).toHaveCount(9);
  await expect(page.getByRole("link", { name: /Ribbon Workshop/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Picnic Pizza/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Fraction Bridge/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Math Meteor Patrol/ })).toBeVisible();
  await page.getByRole("link", { name: "For grown-ups", exact: true }).click();
  await expect(page).toHaveURL(/\/for-grown-ups\/$/);
  await expect(page.getByRole("heading", { name: "For grown-ups", level: 1 })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Use quiz mode" })).not.toBeChecked();
  await expect(page.getByRole("link", { name: "Visit the repository on GitHub" }))
    .toHaveAttribute("href", "https://github.com/some-natalie/kid-games");
  await page.getByText("Read the full MIT license", { exact: true }).click();
  await expect(page.locator(".license-text")).toHaveText(license);
  for (const name of ["SIL Open Font License 1.1", "WordNet license"]) {
    const link = page.getByRole("link", { name, exact: true });
    const response = await page.request.get(await link.getAttribute("href"));
    expect(response.ok()).toBe(true);
  }
});

test("grown-up toggle enables and disables quiz links without saving a browser preference", async ({ page }) => {
  await page.goto("/for-grown-ups/?source=shared#quiz-settings-heading");
  const toggle = page.getByRole("checkbox", { name: "Use quiz mode" });
  await toggle.check();
  await expect(page).toHaveURL(/source=shared&quiz=1#quiz-settings-heading$/);
  await expect(toggle).toBeChecked();
  await expect(page.getByRole("link", { name: "Visit the repository on GitHub" }))
    .toHaveAttribute("href", "https://github.com/some-natalie/kid-games");
  await page.getByRole("link", { name: "Choose a game", exact: true }).click();
  await expect(page).toHaveURL(/\/\?quiz=1$/);
  await page.getByRole("link", { name: /Acorn Adventure/ }).click();
  await expect(page.getByRole("button", { name: "Start quiz", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← All games", exact: true }).click();
  await page.getByRole("link", { name: "For grown-ups", exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page).toHaveURL(/\/for-grown-ups\/$/);
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(".quiz-notice")).toHaveCount(0);
  await page.getByRole("link", { name: "Choose a game", exact: true }).click();
  await page.getByRole("link", { name: /Acorn Adventure/ }).click();
  await expect(page.locator("#start-game")).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("quiz")))).toEqual([]);
});

test("grown-up settings and attribution are accessible and reflow with enlarged text", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  for (const mode of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: mode });
    await page.goto("/for-grown-ups/?quiz=1");
    await expect(page.getByRole("checkbox", { name: "Use quiz mode" })).toBeChecked();
    await page.addStyleTag({ content: ":root { font-size:200%; } p, li, h2, label, pre { letter-spacing:.12em; word-spacing:.16em; line-height:1.5; }" });
    await page.getByText("Read the full MIT license", { exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(audit.violations).toEqual([]);
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  }
});

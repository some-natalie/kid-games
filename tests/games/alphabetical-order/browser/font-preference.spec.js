import { test, expect } from "@playwright/test";

const fontKey = "kid-games.font";
const fontFamily = (element) => getComputedStyle(element).fontFamily;

test("OpenDyslexic is opt-in, persists across pages, and can be turned off with the keyboard", async ({ page }) => {
  const fontRequests = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".woff2")) fontRequests.push(request.url());
  });
  await page.goto("/");
  const toggle = page.getByRole("checkbox", { name: "Use OpenDyslexic font" });
  await expect(toggle).not.toBeChecked();
  expect(await page.locator("body").evaluate(fontFamily)).toBe("system-ui, sans-serif");
  expect(fontRequests).toEqual([]);

  await toggle.check();
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("1em OpenDyslexic"))).toBe(true);
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), fontKey)).toBe("opendyslexic");

  await page.getByRole("link", { name: /Alphabetical Adventure/ }).click();
  await expect(toggle).toBeChecked();
  await expect(page.locator("#start-game")).toBeEnabled();
  await page.locator("#start-game").click();
  await expect(toggle).toBeVisible();
  expect(await page.locator(".word-button").first().evaluate(fontFamily)).toContain("OpenDyslexic");
  expect(await page.locator("#theme-select").evaluate(fontFamily)).toContain("OpenDyslexic");
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).not.toBeChecked();
  expect(await page.locator(".word-button").first().evaluate(fontFamily)).toBe("system-ui, sans-serif");
  await page.reload();
  await expect(toggle).not.toBeChecked();
  expect(await page.locator("body").evaluate(fontFamily)).toBe("system-ui, sans-serif");
});

test("the opted-in font fits phone and tablet layouts before and during play", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "opendyslexic"), fontKey);
  await page.goto("/alphabetical-order/");
  await expect(page.locator("#start-game")).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
  await page.locator("#start-game").click();
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const game = await page.locator(".alphabet-game").boundingBox();
    const rail = await page.locator(".alphabet-rail").boundingBox();
    expect(game.x + game.width).toBeLessThan(rail.x);
  }
});

test("blocked storage reports the problem but still allows changing the font", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  await page.goto("/");
  await expect(page.locator("#font-status")).toContainText("couldn't read your saved font");
  const toggle = page.getByRole("checkbox", { name: "Use OpenDyslexic font" });
  await toggle.check();
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  await expect(page.locator("#font-status")).toContainText("couldn't save it for next time");
  await toggle.uncheck();
  expect(await page.locator("body").evaluate(fontFamily)).toBe("system-ui, sans-serif");
});

test("an invalid saved font uses the default and can be replaced", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "unknown"), fontKey);
  await page.goto("/");
  const toggle = page.getByRole("checkbox", { name: "Use OpenDyslexic font" });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("#font-status")).toContainText("saved font isn't available");
  await toggle.check();
  await expect(page.locator("#font-status")).toBeEmpty();
  expect(await page.evaluate((key) => localStorage.getItem(key), fontKey)).toBe("opendyslexic");
});

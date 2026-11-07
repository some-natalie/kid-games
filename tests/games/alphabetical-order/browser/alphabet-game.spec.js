import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readWordBank } from "../../../../static/alphabet-word-lists.js";

const bank = readWordBank(JSON.parse(readFileSync(new URL("../../../../static/words.json", import.meta.url), "utf8")));
const entries = new Map(bank.map((entry) => [entry.word, entry]));
const preferenceKey = "kid-games.alphabetical-order.preferences";
const buttons = (page) => page.locator("#answer-list .word-button");
const words = (page) => buttons(page).evaluateAll((items) => items.map((item) => item.lastChild.textContent));

async function openGame(page) {
  await page.goto("/alphabetical-order/");
  await expect(page.locator("#theme-select")).toBeEnabled();
}

async function startGame(page, theme = "general") {
  await openGame(page);
  await page.locator("#theme-select").selectOption(theme);
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(12);
}

async function solve(page) {
  const ordered = (await words(page)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  for (const word of [...ordered].reverse()) {
    const index = (await words(page)).indexOf(word);
    await buttons(page).nth(index).press("Home");
  }
  expect(await words(page)).toEqual(ordered);
  await page.locator("#check-order").click();
  await expect(page.locator("#feedback")).toContainText("Fantastic!");
}

test("game starts when the static host serves mjs files as binary downloads", async ({ page }) => {
  await page.route("**/*.mjs", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "content-type": "application/octet-stream",
        "x-content-type-options": "nosniff",
      },
    });
  });
  await startGame(page, "dinosaurs");
  await expect(page.locator("#level-title")).toContainText("Dinosaur");
  await buttons(page).last().press("Home");
  await expect(page.locator("#undo-word")).toBeEnabled();
});

test("only the alphabet game is listed; tutorial and all three levels work", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-tile")).toHaveCount(1);
  await expect(page.locator(".game-tile")).toContainText("Alphabetical Adventure");
  await openGame(page);
  await expect(page.locator("#tutorial")).toBeVisible();
  await expect(page.locator("#play-area")).toBeHidden();
  await page.locator("#start-game").click();
  for (let level = 0; level < 3; level += 1) {
    const current = await words(page);
    expect(current).toHaveLength(12);
    expect(new Set(current).size).toBe(12);
    if (level === 0) expect(new Set(current.map((word) => word[0].toLowerCase())).size).toBe(12);
    if (level === 1) {
      expect(new Set(current.map((word) => word[0].toLowerCase())).size).toBe(6);
      expect(new Set(current.map((word) => word.slice(0, 2).toLowerCase())).size).toBe(12);
    }
    if (level === 2) expect(current.every((word) => entries.get(word).tags.has("dinosaurs"))).toBe(true);
    await solve(page);
    await expect(buttons(page).first()).toBeDisabled();
    if (level < 2) await page.locator("#next-level").click();
  }
  await page.locator("#play-again").click();
  await expect(page.locator("#level-title")).toHaveText("First-letter friends");
  await expect(buttons(page).first()).toBeEnabled();
});

test("mouse dragging reorders, clicking does not, and undo and cancellation preserve the list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "touch-chromium", "Real touch is covered separately.");
  await startGame(page);
  const initial = await words(page);
  await buttons(page).first().click();
  expect(await words(page)).toEqual(initial);
  await page.locator("#answer-list").evaluate((list) => list.scrollIntoView({ block: "start" }));
  const source = await buttons(page).first().boundingBox();
  const target = await buttons(page).nth(3).boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 5, { steps: 8 });
  await expect(page.locator(".drag-ghost")).toHaveCount(1);
  await page.mouse.up();
  const changed = await words(page);
  expect(changed).not.toEqual(initial);
  expect([...changed].sort()).toEqual([...initial].sort());
  await page.locator("#undo-word").click();
  expect(await words(page)).toEqual(initial);
  await page.locator("#answer-list").evaluate((list) => list.scrollIntoView({ block: "start" }));
  const first = await buttons(page).first().boundingBox();
  await page.mouse.move(first.x + 30, first.y + 20);
  await page.mouse.down();
  await page.mouse.move(first.x + 30, first.y + 90, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await words(page)).toEqual(initial);
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  await page.mouse.move(first.x + 30, first.y + 20);
  await page.mouse.down();
  await page.mouse.move(2, first.y + 90, { steps: 4 });
  await page.mouse.up();
  expect(await words(page)).toEqual(initial);
});

test("incorrect checks stay editable and retries retain the same words", async ({ page }) => {
  await startGame(page);
  const original = await words(page);
  const reverse = [...original].sort((a, b) => b.localeCompare(a, "en", { sensitivity: "base" }));
  for (const word of [...reverse].reverse()) {
    await buttons(page).nth((await words(page)).indexOf(word)).press("Home");
  }
  await page.locator("#check-order").click();
  await expect(page.locator("#feedback")).toContainText("Keep dragging");
  await expect(buttons(page).first()).toBeEnabled();
  await page.locator("#restart-level").click();
  expect((await words(page)).sort()).toEqual([...original].sort());
  await solve(page);
});

test("themes persist across reloads, apply to every round, and reset active play", async ({ page }) => {
  await startGame(page, "dinosaurs");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), preferenceKey))
    .toEqual({ version: 1, theme: "dinosaurs" });
  await page.reload();
  await expect(page.locator("#theme-select")).toHaveValue("dinosaurs");
  await expect(page.locator("#start-game")).toBeEnabled();
  await page.locator("#start-game").click();
  for (let round = 0; round < 3; round += 1) {
    expect((await words(page)).every((word) => entries.get(word).tags.has("dinosaurs"))).toBe(true);
    await solve(page);
    if (round < 2) await page.locator("#next-level").click();
  }
  await page.locator("#theme-select").selectOption("flowers");
  await expect(page.locator("#level-count")).toHaveText("Round 1 of 3");
  expect((await words(page)).every((word) => {
    const entry = entries.get(word);
    return entry.tags.has("flowers") && !entry.tags.has("advanced");
  })).toBe(true);
  await expect(page.locator("#undo-word")).toBeDisabled();
});

test("unavailable storage does not prevent play", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Blocked for test", "SecurityError"); },
    });
  });
  await startGame(page, "dinosaurs");
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(buttons(page)).toHaveCount(12);
});

test("malformed or removed saved themes show a notice and restore the default", async ({ page }) => {
  for (const saved of ["{invalid", '{"version":1,"theme":"missing-theme"}']) {
    await openGame(page);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: preferenceKey, value: saved });
    await page.reload();
    await expect(page.locator("#theme-select")).toBeEnabled();
    await expect(page.locator("#theme-select")).toHaveValue("general");
    await expect(page.locator("#preference-status")).not.toHaveText("Your choice is saved only in this browser.");
    await page.locator("#start-game").click();
    await expect(buttons(page)).toHaveCount(12);
  }
});

test("word-bank network failures show a retry and recover", async ({ page }) => {
  await page.route("**/words.json", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/alphabetical-order/");
  await expect(page.locator("#load-status")).toContainText("couldn't load");
  await expect(page.locator("#theme-select")).toBeDisabled();
  await page.unroute("**/words.json");
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(12);
});

test("real touch dragging reorders and auto-scrolls without scrolling during an ordinary drag", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "touch-chromium", "CDP sends real touch input to the mobile Chromium project.");
  await startGame(page);
  const initial = await words(page);
  await page.locator("#answer-list").evaluate((list) => list.scrollIntoView({ block: "start" }));
  const source = await buttons(page).first().boundingBox();
  const target = await buttons(page).nth(3).boundingBox();
  const session = await context.newCDPSession(page);
  const touch = async (type, x, y) => session.send("Input.dispatchTouchEvent", {
    type, touchPoints: type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }],
  });
  const x = source.x + source.width / 2;
  const before = await page.evaluate(() => scrollY);
  await touch("touchStart", x, source.y + source.height / 2);
  await touch("touchMove", x, target.y + 5);
  await expect(page.locator(".drag-ghost")).toHaveCount(1);
  await touch("touchEnd");
  expect(await words(page)).not.toEqual(initial);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await page.locator("#undo-word").click();
  expect(await words(page)).toEqual(initial);
  await page.locator("#answer-list").evaluate((list) =>
    window.scrollTo(0, list.getBoundingClientRect().top + window.scrollY - 250),
  );
  const first = await buttons(page).first().boundingBox();
  await touch("touchStart", x, first.y + first.height / 2);
  await touch("touchMove", x, page.viewportSize().height - 10);
  const scrollStart = await page.evaluate(() => scrollY);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollStart);
  await touch("touchCancel");
  expect(await words(page)).toEqual(initial);
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
});

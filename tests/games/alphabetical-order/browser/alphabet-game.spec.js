import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { QUEST_LEVELS, readWordBank } from "../../../../static/alphabet-word-lists.js";

const bank = readWordBank(JSON.parse(readFileSync(new URL("../../../../static/words.json", import.meta.url), "utf8")));
const entries = new Map(bank.map((entry) => [entry.word, entry]));
const preferenceKey = "kid-games.alphabetical-order.preferences";
const progressKey = "kid-games.alphabetical-order.progress";
const celebrationData = JSON.parse(readFileSync(new URL("../../../../static/celebrations.json", import.meta.url), "utf8"));
const celebrationEffects = new Map(celebrationData.effects.map((effect) => [effect.id, effect]));
const celebrationMessages = celebrationData.messages;
const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
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
  await expect(buttons(page)).toHaveCount(4);
}

async function startAtLevel(page, level, theme = "general") {
  await openGame(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
    { key: progressKey, value: JSON.stringify({ version: 1, themes: { [theme]: { level } } }) });
  await page.reload();
  await page.locator("#theme-select").selectOption(theme);
  await expect(page.locator("#start-game")).toHaveText(`Keep playing level ${level + 1}`);
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(QUEST_LEVELS[level].count);
}

async function solve(page) {
  const ordered = (await words(page)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  for (const word of [...ordered].reverse()) {
    const index = (await words(page)).indexOf(word);
    await buttons(page).nth(index).press("Home");
  }
  expect(await words(page)).toEqual(ordered);
  await page.locator("#check-order").click();
  await expect(page.locator("#feedback")).toContainText("Every word is in the right place!");
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

test("only the alphabet game is listed; the tutorial leads into a 10-level quest with a finale", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await expect(page.locator(".game-tile")).toHaveCount(1);
  await expect(page.locator(".game-tile")).toContainText("Alphabetical Adventure");
  await openGame(page);
  await expect(page.locator("#tutorial")).toBeVisible();
  await expect(page.locator("#play-area")).toBeHidden();
  await expect(page.locator("#new-quest")).toBeHidden();
  await page.locator("#start-game").click();
  for (const [level, settings] of QUEST_LEVELS.entries()) {
    await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of 10 · ${settings.count} words`);
    await expect(page.locator("#level-map li.done")).toHaveCount(level);
    const current = await words(page);
    expect(current).toHaveLength(settings.count);
    expect(new Set(current).size).toBe(settings.count);
    if (level < 3) expect(new Set(current.map((word) => word[0].toLowerCase())).size).toBe(settings.count);
    if (settings.dinosaurs) expect(current.every((word) => entries.get(word).tags.has("dinosaurs"))).toBe(true);
    await solve(page);
    await expect(buttons(page).first()).toBeDisabled();
    await expect(page.locator(".celebration")).toHaveCount(1);
    if (level < QUEST_LEVELS.length - 1) await page.locator("#next-level").click();
  }
  await expect(page.locator("#quest-complete")).toBeVisible();
  await expect(page.locator("#quest-heading")).toHaveText("Show your parent!");
  await expect(page.locator(".dancing-dino")).toBeVisible();
  await expect(page.locator("#play-area")).toBeHidden();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
    .toEqual({ version: 1, themes: {} });
  await page.locator("#play-again").click();
  await expect(page.locator("#level-title")).toHaveText("ABC warm-up");
  await expect(buttons(page)).toHaveCount(4);
  await expect(buttons(page).first()).toBeEnabled();
});

test("the side alphabet stays in order and visible while scrolling at small and tablet sizes", async ({ page }) => {
  await startAtLevel(page, 8);
  const rail = page.getByRole("complementary", { name: "Alphabet reference" });
  await expect(rail.locator("li")).toHaveText([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]);
  for (const viewport of [{ width: 320, height: 568 }, { width: 1024, height: 768 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await rail.boundingBox();
    await page.locator("#check-order").scrollIntoViewIfNeeded();
    const after = await rail.boundingBox();
    expect(after).toEqual(before);
    expect(after.x + after.width).toBeLessThanOrEqual(viewport.width);
    expect(after.y).toBeGreaterThanOrEqual(0);
    expect(after.y + after.height).toBeLessThanOrEqual(viewport.height);
    for (const letter of await rail.locator("li").all()) {
      const bounds = await letter.boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(after.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(after.y + after.height);
    }
    const game = await page.locator(".alphabet-game").boundingBox();
    expect(game.x + game.width).toBeLessThan(after.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator("#check-order").click();
    await expect(page.locator("#feedback")).not.toBeEmpty();
  }
});

test("each success shows a random celebration from the JSON list and stops before the next level", async ({ page }) => {
  const seen = new Set();
  await startGame(page);
  for (let attempt = 0; attempt < 12 && seen.size < 3; attempt += 1) {
    if (attempt > 0) {
      await page.locator("#next-level").click();
      await page.evaluate((key) => localStorage.removeItem(key), progressKey);
      await page.reload();
      await page.locator("#start-game").click();
    }
    await solve(page);
    const layer = page.locator(".celebration");
    await expect(layer).toHaveCount(1);
    const { effect, motion, origin, pieces } = await layer.evaluate((element) => ({
      ...element.dataset, pieces: element.children.length,
    }));
    const settings = celebrationEffects.get(effect);
    expect(settings).toBeTruthy();
    expect(motion).toBe(settings.motion);
    expect(pieces).toBe(settings.count);
    expect({ burst: corners, shower: ["top"], rise: ["bottom"] }[motion]).toContain(origin);
    const feedbackText = await page.locator("#feedback").textContent();
    expect(celebrationMessages.some((message) => feedbackText.startsWith(message))).toBe(true);
    seen.add(effect);
    await expect(page.locator("#feedback")).toHaveClass(/success/);
    await expect(page.locator("#next-level")).toBeFocused();
  }
  expect(seen.size).toBeGreaterThanOrEqual(3);
  await page.locator("#next-level").click();
  await expect(page.locator(".celebration")).toHaveCount(0);
});

test("a missing or invalid celebrations file falls back to built-in celebrations", async ({ page }) => {
  for (const body of [null, JSON.stringify({ version: 1, messages: [], effects: [] })]) {
    await page.unroute("**/celebrations.json");
    await page.route("**/celebrations.json", (route) => body === null ?
      route.fulfill({ status: 404, body: "missing" }) :
      route.fulfill({ status: 200, contentType: "application/json", body }));
    await page.evaluate((key) => localStorage.removeItem(key), progressKey).catch(() => {});
    await startGame(page);
    await solve(page);
    expect(["confetti", "sparkles"]).toContain(await page.locator(".celebration").getAttribute("data-effect"));
  }
});

test("reduced motion shows still celebration pieces and a still dinosaur", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startAtLevel(page, 9);
  await solve(page);
  await expect(page.locator(".celebration .celebration-symbol.still")).toHaveCount(5);
  await expect(page.locator("#quest-complete")).toBeVisible();
  expect(await page.locator(".dino-body").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

test("the current level and word order autosave and resume after reloading", async ({ page }) => {
  await startGame(page);
  await buttons(page).last().press("Home");
  const order = await words(page);
  await page.reload();
  await expect(page.locator("#start-game")).toHaveText("Keep playing level 1");
  await expect(page.locator("#new-quest")).toBeVisible();
  await page.locator("#start-game").click();
  expect(await words(page)).toEqual(order);
  await solve(page);
  await page.reload();
  await expect(page.locator("#start-game")).toHaveText("Keep playing level 2");
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(5);
  await page.reload();
  await page.locator("#new-quest").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10 · 4 words");
});

test("invalid saved progress starts fresh with a notice", async ({ page }) => {
  await openGame(page);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, themes: {
    general: { level: 0, roundWords: ["not", "real", "game", "words"], words: ["not", "real", "game", "words"] },
  } })), progressKey);
  await page.reload();
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await expect(page.locator("#start-game")).toHaveText("Let’s play!");
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(4);
  expect((await words(page)).every((word) => entries.get(word)?.tags.has("general"))).toBe(true);
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

test("themes persist, use the level word counts, and keep separate progress", async ({ page }) => {
  await startGame(page, "dinosaurs");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), preferenceKey))
    .toEqual({ version: 1, theme: "dinosaurs" });
  for (const count of [4, 5]) {
    await expect(buttons(page)).toHaveCount(count);
    expect((await words(page)).every((word) => entries.get(word).tags.has("dinosaurs"))).toBe(true);
    await solve(page);
    await page.locator("#next-level").click();
  }
  await page.reload();
  await expect(page.locator("#theme-select")).toHaveValue("dinosaurs");
  await expect(page.locator("#start-game")).toHaveText("Keep playing level 3");
  await page.locator("#start-game").click();
  const dinosaurWords = await words(page);
  expect(dinosaurWords).toHaveLength(6);
  await page.locator("#theme-select").selectOption("flowers");
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 10 · 4 words");
  expect((await words(page)).every((word) => {
    const entry = entries.get(word);
    return entry.tags.has("flowers") && !entry.tags.has("advanced");
  })).toBe(true);
  await expect(page.locator("#undo-word")).toBeDisabled();
  await page.locator("#theme-select").selectOption("dinosaurs");
  await expect(page.locator("#level-count")).toHaveText("Level 3 of 10 · 6 words");
  expect(await words(page)).toEqual(dinosaurWords);
});

test("unavailable storage does not prevent play", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Blocked for test", "SecurityError"); },
    });
  });
  await startGame(page, "dinosaurs");
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
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
    await expect(buttons(page)).toHaveCount(4);
  }
});

test("word-bank network failures show a retry and recover", async ({ page }) => {
  await page.route("**/words.json", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/alphabetical-order/");
  await expect(page.locator("#load-status")).toContainText("couldn't load");
  await expect(page.locator("#theme-select")).toBeDisabled();
  await page.unroute("**/words.json");
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(4);
});

test("word list blocks native selection and callouts without blocking the rest of the page", async ({ page }) => {
  await startGame(page);
  const behavior = await buttons(page).first().evaluate((button) => {
    const targets = [button.closest("ol"), button.parentElement, button, button.querySelector(".drag-handle")];
    return targets.map((target) => ({
      userSelect: getComputedStyle(target).userSelect || getComputedStyle(target).webkitUserSelect,
      events: ["selectstart", "contextmenu", "dragstart"].map((type) =>
        target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })),
      ),
    }));
  });
  for (const target of behavior) {
    expect(target.userSelect).toBe("none");
    expect(target.events).toEqual([false, false, false]);
  }
  expect(await page.locator("#sort-instructions").evaluate((element) =>
    element.dispatchEvent(new Event("contextmenu", { bubbles: true, cancelable: true })),
  )).toBe(true);
});

test("real touch dragging reorders and auto-scrolls without scrolling during an ordinary drag", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "touch-chromium", "CDP sends real touch input to the mobile Chromium project.");
  await startAtLevel(page, 8);
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
  // A child may rest a finger on the word before beginning to move it.
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
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

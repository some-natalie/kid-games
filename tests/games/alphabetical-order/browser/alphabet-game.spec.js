import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { QUEST_LEVELS, readWordBank } from "../../../../static/alphabet-word-lists.js";
import { VICTORY_SCENES } from "../../../../static/alphabet-victory.js";

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

test("the alphabet game is listed; the tutorial leads into a 10-level quest with a finale", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Alphabetical Adventure/ })).toBeVisible();
  await expect(page.locator(".game-tile").first()).toContainText("Alphabetical Adventure");
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
  await expect(page.locator("[data-victory-scene]:visible")).toHaveCount(1);
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

test("the stylesheet URL is versioned so older cached CSS cannot unpin the alphabet", async ({ page }) => {
  await page.route("**/style.css", (route) => {
    const url = new URL(route.request().url());
    if (!url.search) {
      return route.fulfill({ contentType: "text/css", body: "body { background: white; }" });
    }
    return route.continue();
  });
  await startGame(page);
  const stylesheet = new URL(await page.locator('link[rel="stylesheet"]').getAttribute("href"), page.url());
  expect(stylesheet.searchParams.get("h")).toMatch(/^[a-f0-9]{20}$/);
  expect(await page.locator(".alphabet-rail").evaluate((element) => getComputedStyle(element).position))
    .toBe("fixed");
  expect(await page.locator(".alphabet-rail ol").evaluate((element) => getComputedStyle(element).listStyleType))
    .toBe("none");
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
  await page.evaluate(() => { Math.random = () => 0; });
  await solve(page);
  await expect(page.locator(".celebration .celebration-symbol.still")).toHaveCount(5);
  await expect(page.locator("#quest-complete")).toBeVisible();
  await expect(page.locator(".dancing-dino")).toBeVisible();
  expect(await page.locator(".dino-body").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

for (const [index, scene] of VICTORY_SCENES.entries()) {
  test(`the ${scene} victory is selected at quest completion and replay starts fresh`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
    await page.setViewportSize({ width: 320, height: 568 });
    await startAtLevel(page, 9);
    await page.evaluate((value) => { Math.random = () => value; }, (index + 0.5) / VICTORY_SCENES.length);
    await solve(page);
    const finale = page.locator("#quest-complete");
    await expect(finale).toBeVisible();
    await expect(finale).toHaveAttribute("data-victory", scene);
    const selected = finale.locator("[data-victory-scene]:visible");
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute("data-victory-scene", scene);
    await expect(finale.getByRole("img")).toHaveCount(1);
    expect(await finale.getByRole("img").getAttribute(scene === "dinosaur" ? "aria-labelledby" : "aria-label")).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const characters = selected.locator(".victory-character");
    for (const character of await characters.all()) {
      expect(await character.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const character of await characters.all()) {
      expect(await character.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    }
    await expect(page.locator("#quest-heading")).toBeFocused();
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
      .toEqual({ version: 1, themes: {} });
    await page.locator("#play-again").click();
    await expect(finale).toBeHidden();
    await expect(page.locator("#level-title")).toHaveText("ABC warm-up");
    await expect(buttons(page)).toHaveCount(4);
  });
}

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
  const listBox = await page.locator("#answer-list").boundingBox();
  await page.mouse.move(listBox.x + listBox.width + 100, first.y + 90, { steps: 4 });
  await page.mouse.up();
  expect(await words(page)).toEqual(initial);
});

test("move buttons give precise one-step changes, retain focus, and save the order", async ({ page }, testInfo) => {
  await startGame(page);
  const initial = await words(page);
  const up = page.locator(".move-word[data-direction='up']");
  const down = page.locator(".move-word[data-direction='down']");
  await expect(up.first()).toBeDisabled();
  await expect(down.last()).toBeDisabled();
  const tap = async (locator) => testInfo.project.name === "touch-chromium" ? locator.tap() : locator.click();
  const sizes = await page.locator(".move-word").evaluateAll((items) =>
    items.map((item) => ({ width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })));
  expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await tap(down.first());
  expect(await words(page)).toEqual([initial[1], initial[0], ...initial.slice(2)]);
  await expect(down.nth(1)).toBeFocused();
  await expect(page.locator("#progress")).toContainText(`${initial[0]} moved to position 2`);
  await tap(up.nth(1));
  expect(await words(page)).toEqual(initial);
  await expect(buttons(page).first()).toBeFocused();
  await tap(up.last());
  const changed = [initial[0], initial[1], initial[3], initial[2]];
  expect(await words(page)).toEqual(changed);
  await page.locator("#undo-word").click();
  expect(await words(page)).toEqual(initial);
  await tap(up.last());
  expect(await words(page)).toEqual(changed);
  await page.reload();
  await page.locator("#start-game").click();
  expect(await words(page)).toEqual(changed);
  await expect(page.locator("#undo-word")).toBeDisabled();
  await solve(page);
  await expect(page.locator(".move-word:enabled")).toHaveCount(0);
});

test("dragging by a word edge snaps to the adjacent row and tolerates a near-edge drop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "touch-chromium", "Real touch is covered separately.");
  await startGame(page);
  const initial = await words(page);
  await page.locator("#answer-list").evaluate((list) => list.scrollIntoView({ block: "center" }));
  const source = await buttons(page).first().boundingBox();
  const target = await buttons(page).nth(1).boundingBox();
  const x = source.x + 30;
  const y = source.y + source.height - 4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + target.y - source.y, { steps: 8 });
  await expect(page.locator("#answer-list li").nth(2)).toHaveClass("drop-before");
  await page.mouse.up();
  expect(await words(page)).toEqual([initial[1], initial[0], ...initial.slice(2)]);
  await page.locator("#undo-word").click();
  await page.locator("#answer-list").evaluate((list) => list.scrollIntoView({ block: "center" }));
  const last = await buttons(page).last().boundingBox();
  const previous = await buttons(page).nth(2).boundingBox();
  const listBox = await page.locator("#answer-list").boundingBox();
  await page.mouse.move(last.x + 30, last.y + 4);
  await page.mouse.down();
  await page.mouse.move(listBox.x + listBox.width + 24, previous.y + 4, { steps: 8 });
  await expect(page.locator("#answer-list li").nth(2)).toHaveClass("drop-before");
  await page.mouse.up();
  expect(await words(page)).toEqual([initial[0], initial[1], initial[3], initial[2]]);
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

test("starting a level collapses the header, intro, and directions into a compact bar", async ({ page }) => {
  await openGame(page);
  for (const selector of [".site-header", ".intro", "#theme-help", "#preference-status", "#tutorial"]) {
    await expect(page.locator(selector)).toBeVisible();
  }
  await page.locator("#start-game").click();
  await expect(buttons(page)).toHaveCount(4);
  for (const selector of [".site-header", ".intro", "#theme-help", "#preference-status", "#tutorial", "#sort-instructions"]) {
    await expect(page.locator(selector)).toBeHidden();
  }
  const bar = page.locator(".theme-picker");
  await expect(bar.getByRole("link", { name: "← All games" })).toBeVisible();
  await expect(page.locator("#theme-select")).toBeVisible();
  const [barBox, levelBox] = [await bar.boundingBox(), await page.locator("#level-map").boundingBox()];
  expect(barBox.height).toBeLessThan(140);
  expect(levelBox.y).toBeLessThan(page.viewportSize().height / 2);
  await page.getByText("How to play").click();
  await expect(page.locator("#sort-instructions")).toBeVisible();
  await page.getByText("How to play").click();
  await expect(page.locator("#sort-instructions")).toBeHidden();
  await page.locator("#theme-select").selectOption("dinosaurs");
  await expect(page.locator(".intro")).toBeHidden();
  await expect(buttons(page)).toHaveCount(4);
  await bar.getByRole("link", { name: "← All games" }).click();
  await expect(page.getByRole("link", { name: /Alphabetical Adventure/ })).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
});

test("storage warnings stay visible in the compact bar", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Blocked for test", "SecurityError"); },
    });
  });
  await startGame(page);
  await expect(page.locator(".intro")).toBeHidden();
  await expect(page.locator("#preference-status")).toBeVisible();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
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
  const adjacent = await buttons(page).nth(1).boundingBox();
  await touch("touchStart", x, source.y + source.height - 4);
  await touch("touchMove", x, adjacent.y + adjacent.height - 4);
  await expect(page.locator("#answer-list li").nth(2)).toHaveClass("drop-before");
  await touch("touchEnd");
  expect(await words(page)).toEqual([initial[1], initial[0], ...initial.slice(2)]);
  await page.locator("#undo-word").click();
  await page.locator("#answer-list").evaluate((list) => list.scrollIntoView({ block: "start" }));
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

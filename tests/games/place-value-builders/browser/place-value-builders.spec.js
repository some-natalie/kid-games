import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LEVELS, PLACES, makeQuizQuestion } from "../../../../static/place-value-builders-engine.js";
import { GAME_CELEBRATIONS } from "../../../../static/game-celebrations.js";
import { cheerPattern, expectThemedCelebration } from "../../shared/celebrations.js";

const rewards = GAME_CELEBRATIONS["place-value-builders"];
const progressKey = "kid-games.place-value-builders.progress";
const blockNames = { ones: "unit cube", tens: "ten rod", hundreds: "hundred flat", thousands: "thousand cube" };

async function solveQuizBuild(page, index) {
  if (index === 2) {
    await page.getByRole("button", { name: "Exchange 1 ten for 10 ones", exact: true }).click();
  } else {
    for (const lower of ["ones", "tens", "hundreds"]) {
      const higher = PLACES[PLACES.indexOf(lower) - 1].slice(0, -1);
      const exchange = page.getByRole("button", { name: `Exchange 10 ${lower} for one ${higher}`, exact: true });
      while (await exchange.isEnabled()) await exchange.click();
    }
  }
  for (const place of PLACES) {
    const text = await page.locator(`[data-drop="${place}"] .place-value-count`).textContent();
    const count = Number.parseInt(text);
    const target = LEVELS[index].answer[place];
    for (let number = count; number < target; number += 1) {
      await page.getByRole("button", { name: `Add one ${blockNames[place]}`, exact: true }).click();
    }
    for (let number = count; number > target; number -= 1) {
      await page.getByRole("button", { name: `Remove one ${blockNames[place]}`, exact: true }).first().click();
    }
  }
}

async function dragBlock(page, source, target, cancel = false) {
  const fromTop = await source.evaluate((node) => node.getBoundingClientRect().top + scrollY);
  const toTop = await target.evaluate((node) => node.getBoundingClientRect().top + scrollY);
  await page.evaluate((top) => window.scrollTo(0, Math.max(0, top - 40)), Math.min(fromTop, toTop));
  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  const start = { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + sourceBounds.height / 2 };
  const end = { x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + Math.min(35, targetBounds.height / 2) };
  if (test.info().project.name === "touch-chromium") {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 8; step += 1) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{
        x: start.x + (end.x - start.x) * step / 8, y: start.y + (end.y - start.y) * step / 8,
      }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    if (cancel) {
      await source.dispatchEvent("pointercancel", { pointerId: 1 });
    }
    await page.mouse.up();
  }
}

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
  await expect(page.locator(".celebration")).toHaveCount(0);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
}

test("the worked example, keyboard controls, hints, and first build are accessible", async ({ page }) => {
  await page.goto("/place-value-builders/");
  await expect(page.getByRole("heading", { name: "Worked example: trade 10 ones for 1 ten" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("14 ones");
  await expect(page.locator("#tutorial")).toContainText("zero in 105");
  await expect(page.locator(".place-value-progression li")).toHaveCount(5);
  await expect(page.locator("#tutorial")).toContainText("no timer");
  await expect(page.locator("#tutorial")).not.toContainText(/\bages?\b/i);
  await audit(page);

  await page.getByRole("button", { name: "Start building" }).press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await page.getByRole("button", { name: "Check my build" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("Not quite yet");
  await expect(page.locator("#place-value-hint")).toContainText("Add six ones");
  await expect(page.locator(".celebration")).toHaveCount(0);
  const addOne = page.getByRole("button", { name: "Add one unit cube" });
  for (let index = 0; index < 6; index += 1) await addOne.press("Enter");
  await expect(page.locator("#number-readout")).toContainText("Number: 6");
  await page.getByRole("button", { name: "Check my build" }).press("Enter");
  await expect(page.locator("#feedback")).toHaveText(cheerPattern(rewards, "6 is 0 thousands, 0 hundreds, 0 tens, and 6 ones."));
  await expectThemedCelebration(page, rewards);
  await expect(page.locator("#next-level")).toBeFocused();
  await expect(addOne).toBeDisabled();
  await audit(page);
});

test("exchanging ones for a ten and a ten back preserves the visible number", async ({ page }) => {
  await start(page, 1);
  await expect(page.locator("#number-readout")).toContainText("Number: 14");
  await page.getByRole("button", { name: "Exchange 10 ones for one ten" }).click();
  await expect(page.locator("#number-readout")).toContainText("1 ten, and 4 ones");
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#feedback")).toContainText("14 is 0 thousands, 0 hundreds, 1 ten, and 4 ones");
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
  await expect(page.locator("#feedback")).toContainText("105 is 0 thousands, 1 hundred, 0 tens, and 5 ones");
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
  await expect(page.getByRole("button", { name: "Next level" })).toBeVisible();
});

test("quiz keeps saved progress private, supports revisions, and grades at submission", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript((key) => localStorage.setItem(key, "normal game progress"), progressKey);
  await page.goto("/place-value-builders/?quiz=1");
  await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Check/ })).toHaveCount(0);
  await audit(page);

  const questions = LEVELS.map((_, index) => makeQuizQuestion(index));
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "Add one unit cube" }).click();
  }
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Add one unit cube" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.locator('[data-drop="ones"] .place-value-count')).toHaveText("15 ones");
  await page.getByRole("button", { name: "Remove one unit cube" }).first().click();
  await solveQuizBuild(page, 1);
  await page.getByRole("button", { name: "Next question" }).click();
  for (let index = 2; index < questions.length; index += 1) {
    if (questions[index].kind === "place-value-build") await solveQuizBuild(page, index);
    else {
      const correct = questions[index].choices.find((choice) => choice.value === questions[index].expected);
      await page.getByRole("button", { name: correct.label, exact: true }).click();
    }
    await expect(page.locator(".celebration")).toHaveCount(0);
    await page.getByRole("button", { name: index === questions.length - 1 ? "Review answers" : "Next question" }).click();
  }
  await page.getByRole("button", { name: "Edit question 2" }).click();
  await expect(page.locator('[data-drop="tens"] .place-value-count')).toHaveText("1 ten");
  await expect(page.locator('[data-drop="ones"] .place-value-count')).toHaveText("4 ones");
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("92% correct (11 of 12 questions)");
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText("5 ones");
  await expect(page.locator("#quest-complete details")).toContainText(questions[0].correction);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe("normal game progress");
  await audit(page);
});

test("tangible base-ten models can be dragged in and out, with invalid and cancelled drops unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1800 });
  await start(page);
  const tray = page.getByRole("group", { name: "Block tray" });
  await expect(tray.locator(".base-ten-ones rect")).toHaveCount(3);
  await expect(tray.locator(".base-ten-tens .base-ten-face-top rect")).toHaveCount(10);
  await expect(tray.locator(".base-ten-hundreds .base-ten-face-top rect")).toHaveCount(100);
  for (const face of ["top", "front", "side"]) {
    await expect(tray.locator(`.base-ten-thousands .base-ten-face-${face} rect`)).toHaveCount(100);
  }
  await expect(tray.locator(".base-ten-thousands")).toHaveAttribute("viewBox", "0 0 122 132");
  for (const place of PLACES) {
    await dragBlock(page, page.getByRole("button", { name: `Add one ${blockNames[place]}` }),
      page.locator(`[data-drop="${place}"]`));
    await expect(page.locator(`[data-drop="${place}"] .place-value-count`)).toContainText(`1 ${place.slice(0, -1)}`);
  }
  await expect(page.locator("#number-readout")).toContainText("Number: 1111");
  await dragBlock(page, page.getByRole("button", { name: "Add one unit cube" }), page.locator('[data-drop="hundreds"]'));
  await expect(page.locator(".block-announcement")).toContainText("matching place");
  await expect(page.locator("#number-readout")).toContainText("Number: 1111");
  await dragBlock(page, page.getByRole("button", { name: "Add one unit cube" }), page.locator('[data-drop="ones"]'), true);
  await expect(page.locator("#number-readout")).toContainText("Number: 1111");
  await expect(page.locator(".base-ten-drag-ghost")).toHaveCount(0);
  for (const place of PLACES) {
    await dragBlock(page, page.getByRole("button", { name: `Remove one ${blockNames[place]}` }).first(), tray);
  }
  await expect(page.locator("#number-readout")).toContainText("Number: 0");
  const addOne = page.getByRole("button", { name: "Add one unit cube" });
  await addOne.press("Enter");
  await expect(page.locator("#number-readout")).toContainText("Number: 1");
  await page.getByRole("button", { name: "Remove one unit cube" }).press("Enter");
  await expect(addOne).toBeFocused();
  await expect(page.locator("#number-readout")).toContainText("Number: 0");
  await audit(page);
});

test("dragging hundreds and thousands performs reversible trades and a thousand build completes", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1800 });
  await start(page, 10);
  await dragBlock(page, page.getByRole("button", { name: "Remove one hundred flat" }).first(),
    page.locator('[data-drop="thousands"]'));
  await expect(page.locator("#number-readout")).toContainText("Number: 1000");
  await expect(page.locator('[data-drop="thousands"] .place-value-count')).toHaveText("1 thousand");
  await expect(page.locator('[data-drop="hundreds"] .place-value-count')).toHaveText("0 hundreds");
  await dragBlock(page, page.getByRole("button", { name: "Remove one thousand cube" }),
    page.locator('[data-drop="hundreds"]'));
  await expect(page.locator("#number-readout")).toContainText("Number: 1000");
  await expect(page.locator('[data-drop="hundreds"] .place-value-count')).toHaveText("10 hundreds");
  await page.getByRole("button", { name: "Exchange 10 hundreds for one thousand" }).press("Enter");
  await page.getByRole("button", { name: "Check my build" }).click();
  await expectThemedCelebration(page, rewards);
  await page.getByRole("button", { name: "Next level" }).click();
  await expect(page.locator("#level-title")).toBeFocused();
  for (const [place, count] of [["thousands", 1], ["hundreds", 2], ["tens", 3], ["ones", 4]]) {
    for (let index = 0; index < count; index += 1) {
      await dragBlock(page, page.getByRole("button", { name: `Add one ${blockNames[place]}` }),
        page.locator(`[data-drop="${place}"]`));
    }
  }
  await expect(page.locator("#number-readout")).toContainText("Number: 1234");
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#feedback")).toContainText("1 thousand, 2 hundreds, 3 tens, and 4 ones");
  await expect(page.getByRole("button", { name: "Add one thousand cube" })).toBeDisabled();
  await page.getByRole("button", { name: "Finish building" }).click();
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expectThemedCelebration(page, rewards);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
});

test("quiz dragging retains additions and reversible thousand trades without grading or normal saves", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1800 });
  await page.addInitScript((key) => localStorage.setItem(key, '{"version":1,"level":7}'), progressKey);
  await page.goto("/place-value-builders/?quiz=1");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await dragBlock(page, page.getByRole("button", { name: "Add one unit cube" }), page.locator('[data-drop="ones"]'));
  await expect(page.locator(".place-value-readout")).not.toContainText("Number:");
  await expect(page.locator(".celebration, #place-value-hint, #feedback, .quiz-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.locator('[data-drop="ones"] .place-value-count')).toHaveText("1 one");
  for (let index = 0; index < 10; index += 1) await page.getByRole("button", { name: "Next question" }).click();
  await dragBlock(page, page.getByRole("button", { name: "Remove one hundred flat" }).first(),
    page.locator('[data-drop="thousands"]'));
  await expect(page.locator('[data-drop="thousands"] .place-value-count')).toHaveText("1 thousand");
  await page.getByRole("button", { name: "Previous question" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.locator('[data-drop="thousands"] .place-value-count')).toHaveText("1 thousand");
  await dragBlock(page, page.getByRole("button", { name: "Remove one thousand cube" }), page.locator('[data-drop="hundreds"]'));
  await expect(page.locator('[data-drop="hundreds"] .place-value-count')).toHaveText("10 hundreds");
  await expect(page.locator(".celebration, .quiz-score")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe('{"version":1,"level":7}');
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

test("block building and removal reflow with enlarged OpenDyslexic in normal and quiz modes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  for (const quiz of [false, true]) {
    await page.emulateMedia({ colorScheme: quiz ? "dark" : "light", reducedMotion: "reduce" });
    if (quiz) {
      await page.goto("/place-value-builders/?quiz=1");
      await page.getByRole("button", { name: "Start quiz" }).click();
    } else {
      await start(page, 11);
    }
    await page.addStyleTag({ content: `
      :root { font-size: 200%; }
      p, h1, h2, h3, button, summary {
        line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;
      }
    ` });
    await page.evaluate(() => document.fonts.ready);
    const add = page.getByRole("button", { name: "Add one thousand cube" });
    if (test.info().project.name === "touch-chromium") await add.tap();
    else await add.press("Enter");
    await expect(page.locator('[data-drop="thousands"] .place-value-count')).toHaveText("1 thousand");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    for (const button of await page.locator(".place-value-editor button").all()) {
      const bounds = await button.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await audit(page);
    await page.getByRole("button", { name: "Remove one thousand cube" }).press("Enter");
    await expect(add).toBeFocused();
    await expect(page.locator('[data-drop="thousands"] .place-value-count')).toHaveText("0 thousands");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    if (quiz) await expect(page.locator(".celebration, .quiz-score")).toHaveCount(0);
  }
});

test("small-screen dragging scrolls to a drop column and stops scrolling after release", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await start(page);
  await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
  const source = page.getByRole("button", { name: "Add one unit cube" });
  await source.scrollIntoViewIfNeeded();
  const bounds = await source.boundingBox();
  const startPoint = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const edge = { x: 160, y: 548 };
  const session = test.info().project.name === "touch-chromium"
    ? await page.context().newCDPSession(page) : undefined;
  if (session) {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [startPoint] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [edge] });
  } else {
    await page.mouse.move(startPoint.x, startPoint.y);
    await page.mouse.down();
    await page.mouse.move(edge.x, edge.y, { steps: 4 });
  }
  const before = await page.evaluate(() => scrollY);
  const column = page.locator('[data-drop="ones"]');
  for (let index = 0; index < 60; index += 1) {
    const box = await column.boundingBox();
    if (box.y < 488 && box.y + box.height > 80) break;
    await page.clock.runFor(100);
  }
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before);
  const target = await column.boundingBox();
  const endPoint = { x: target.x + target.width / 2, y: Math.max(80, Math.min(target.y + 35, 488)) };
  if (session) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [endPoint] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(endPoint.x, endPoint.y);
    await page.mouse.up();
  }
  await expect(page.locator('[data-drop="ones"] .place-value-count')).toHaveText("1 one");
  await expect(page.locator(".base-ten-drag-ghost")).toHaveCount(0);
  const stopped = await page.evaluate(() => scrollY);
  await page.clock.runFor(500);
  expect(await page.evaluate(() => scrollY)).toBe(stopped);
});

test("storage failures are visible and do not prevent play", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.goto("/place-value-builders/");
  await expect(page.locator("#preference-status")).toContainText("start fresh");
  await page.getByRole("button", { name: "Start building" }).click();
  await page.getByRole("button", { name: "Add one unit cube" }).click();
  await expect(page.locator("#number-readout")).toContainText("Number: 1");
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "Add one unit cube" }).click();
  await page.getByRole("button", { name: "Check my build" }).click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#feedback")).toHaveText(cheerPattern(rewards));
});

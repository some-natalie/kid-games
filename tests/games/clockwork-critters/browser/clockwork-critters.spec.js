import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GAME_CELEBRATIONS } from "../../../../static/game-celebrations.js";
import { buildRound, formatTime } from "../../../../static/clockwork-critters-engine.js";
import { expectThemedCelebration } from "../../shared/celebrations.js";

const progressKey = "kid-games.clockwork-critters.progress";
const hourBack = (page) => page.getByRole("button", { name: "Move hour hand back one hour" });

async function start(page, level) {
  await page.goto("/clockwork-critters/");
  if (level !== undefined) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
}

async function solveSettingActivity(page) {
  const prompt = await page.locator("#clock-prompt").textContent();
  const [, hour, minute] = prompt.match(/to (\d+):(\d\d)/);
  for (let step = 0; step < (12 - Number(hour)) % 12; step += 1) await hourBack(page).click();
  const interval = Number((await page.getByRole("button", { name: /Move minute hand forward/ }).textContent()).match(/\d+/)[0]);
  for (let step = 0; step < Number(minute) / interval; step += 1) {
    await page.getByRole("button", { name: `Move minute hand forward ${interval} minutes` }).click();
  }
  await page.locator("#check-clock").click();
  await expect(page.locator("#feedback")).toContainText("That's");
}

async function solveQuizQuestion(page, questionIndex) {
  const prompt = await page.locator("#quiz-question-heading + p").textContent();
  if (prompt.startsWith("Set the clock to")) {
    const [, hour, minute] = prompt.match(/to (\d+):(\d\d)/);
    const targetHour = Number(hour) % 12 || 12;
    for (let step = 0; step < (12 - targetHour) % 12; step += 1) {
      await page.getByRole("button", { name: "Move hour hand back one hour" }).click();
    }
    const interval = Number((await page.getByRole("button", { name: /Move minute hand forward/ }).first().textContent()).match(/\d+/)[0]);
    for (let step = 0; step < Number(minute) / interval; step += 1) {
      await page.getByRole("button", { name: `Move minute hand forward ${interval} minutes` }).click();
    }
  } else {
    const time = formatTime(buildRound(Math.floor(questionIndex / 5))[questionIndex % 5].time);
    await page.getByRole("button", { name: time, exact: true }).click();
  }
  await page.locator(".quiz-navigation").getByRole("button").nth(1).click();
}

async function audit(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("worked example leads to keyboard clock-setting and reading with hints and retries", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Clockwork Critters/ }).click();
  await expect(page).toHaveURL(/\/clockwork-critters\/$/);
  await expect(page.getByRole("heading", { name: "Worked example: 3:30" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("There is no timer");
  await page.locator("#start-game").press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.locator("#mode-set")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#clock-description")).toContainText("12:00");
  await page.locator("#check-clock").press("Space");
  await expect(page.locator("#feedback")).toContainText("Not quite");
  await expect(page.locator("#clock-hint")).toContainText("minute hand points straight up to 12");
  await expect(page.locator(".celebration")).toHaveCount(0);
  for (let step = 0; step < 6; step += 1) await hourBack(page).press("Space");
  await expect(page.locator("#clock-description")).toContainText("6:00");
  await expect(page.locator("#clock-display .clock-hand-hour")).toHaveAttribute("transform", "rotate(180 90 90)");
  await page.locator("#check-clock").press("Enter");
  await expect(page.locator("#feedback")).toContainText("That's");
  await expect(page.locator("#next-step")).toBeFocused();
  await expectThemedCelebration(page, GAME_CELEBRATIONS["clockwork-critters"]);
  await audit(page);
  await page.locator("#next-step").press("Enter");
  await page.locator("#mode-read").press("Enter");
  await expect(page.locator("#clock-description")).toContainText("hour hand is on 7");
  const readAnswer = page.getByRole("button", { name: "7:00", exact: true });
  if (test.info().project.name === "touch-chromium") await readAnswer.tap();
  else await readAnswer.press("Space");
  await expect(page.locator("#feedback")).toContainText("That's");
  await audit(page);
});

test("all four levels save progress, and a new schedule preserves other games' saves", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await page.evaluate(() => localStorage.setItem("kid-games.number-trail.progress", '{"version":1,"level":3}'));
  for (let level = 0; level < 4; level += 1) {
    await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of 4`);
    await expect(page.locator("#level-instructions")).toContainText(
      ["whole hours", "half-hours", "quarter-hours", "five-minute intervals"][level]);
    for (let step = 0; step < 5; step += 1) {
      await solveSettingActivity(page);
      if (step === 4 && level < 3) {
        expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
          .toEqual({ version: 1, level: level + 1 });
      }
      await page.locator("#next-step").click();
    }
  }
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expect(page.locator("#quest-complete")).toContainText("set and read clocks");
  await expectThemedCelebration(page, GAME_CELEBRATIONS["clockwork-critters"]);
  expect(await page.locator(".celebration").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("kid-games.number-trail.progress")))
    .toBe('{"version":1,"level":3}');
  await page.locator("#play-again").click();
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 4");
});

test("quiz withholds grading, retains revisions, scores exact answers, and leaves saved progress alone", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/clockwork-critters/?quiz=1");
  await page.evaluate((key) => localStorage.setItem(key, '{"version":1,"level":2}'), progressKey);
  await page.reload();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.locator("#tutorial")).toHaveCount(0);
  await expect(page.locator("#clock-hint")).toHaveCount(0);
  await expect(page.locator("#feedback")).toHaveCount(0);
  await audit(page);
  await solveQuizQuestion(page, 0);
  await expect(page.locator("#quiz-question-heading + p")).toContainText("What time is shown");
  await audit(page);
  const answer = formatTime(buildRound(0)[1].time);
  const readingAnswers = page.locator(".clock-choices button");
  const wrongAnswer = readingAnswers.filter({ hasNotText: answer }).first();
  const revisedAnswer = await wrongAnswer.textContent();
  await wrongAnswer.click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.locator(".clock-description")).toContainText("hour hand is on 6");
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(readingAnswers).toHaveCount(4);
  await expect(readingAnswers.filter({ hasText: revisedAnswer })).toHaveAttribute("aria-pressed", "true");
  for (let question = 1; question < 20; question += 1) await solveQuizQuestion(page, question);
  await page.getByRole("button", { name: "Edit question 1", exact: true }).click();
  await page.getByRole("button", { name: "Move hour hand forward one hour" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  for (let question = 1; question < 19; question += 1) {
    await page.getByRole("button", { name: "Next question" }).click();
  }
  await expect(page.getByRole("button", { name: "Review answers" })).toBeVisible();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("95% correct (19 of 20 questions)");
  await page.getByText("Answer details").click();
  await expect(page.locator("#quest-complete")).toContainText("Your answer: 7:00. The correct time is 6:00.");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey))
    .toBe('{"version":1,"level":2}');
});

test("blocked storage is reported, and tutorial and play remain accessible in light and dark modes", async ({ page }) => {
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/clockwork-critters/");
    await audit(page);
    await start(page);
    await page.locator("#show-hint").click();
    await expect(page.locator("#clock-hint")).toBeVisible();
    await audit(page);
  }
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.goto("/clockwork-critters/");
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#level-title")).toBeVisible();
});

test("clock controls reflow with enlarged OpenDyslexic text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page, 3);
  await page.addStyleTag({ content: `
    :root { font-size: 200%; }
    p, h1, h2, h3, button, summary {
      line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;
    }
    p { margin-bottom: 2em !important; }
  ` });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of await page.locator(".clock-controls button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
});

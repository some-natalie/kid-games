import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GAME_CELEBRATIONS } from "../../../../static/game-celebrations.js";
import { buildRound, formatTime } from "../../../../static/clockwork-critters-engine.js";
import { expectThemedCelebration } from "../../shared/celebrations.js";

const progressKey = "kid-games.clockwork-critters.progress";
const hourHand = (page) => page.getByRole("slider", { name: "Hour hand" });
const minuteHand = (page) => page.getByRole("slider", { name: "Minute hand" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.999; });
});

async function setHands(page, hour, minute) {
  const interval = 60 - Number(await minuteHand(page).getAttribute("aria-valuemax"));
  const currentMinute = Number(await minuteHand(page).getAttribute("aria-valuenow"));
  for (let step = 0; step < (Number(minute) - currentMinute + 60) % 60 / interval; step += 1) {
    await minuteHand(page).press("ArrowRight");
  }
  const currentHour = Number(await hourHand(page).getAttribute("aria-valuenow"));
  for (let step = 0; step < (currentHour - Number(hour) + 12) % 12; step += 1) {
    await hourHand(page).press("ArrowLeft");
  }
}

async function dragHand(page, hand, angle, gripRadius = hand === "hour" ? 33 : 60) {
  const slider = page.getByRole("slider", { name: `${hand === "hour" ? "Hour" : "Minute"} hand` });
  await slider.scrollIntoViewIfNeeded();
  const points = await slider.evaluate((node, { angle, gripRadius }) => {
    const face = node.ownerSVGElement;
    const start = Number(node.getAttribute("transform").match(/rotate\(([\d.]+)/)[1]);
    return Array.from({ length: 13 }, (_, index) => {
      const radians = (start + (angle - start) * index / 12) * Math.PI / 180;
      const point = face.createSVGPoint();
      const radius = index === 0 ? gripRadius : 60;
      point.x = 90 + Math.sin(radians) * radius;
      point.y = 90 - Math.cos(radians) * radius;
      const screen = point.matrixTransform(face.getScreenCTM());
      return { x: screen.x, y: screen.y };
    });
  }, { angle, gripRadius });
  if (test.info().project.name === "touch-chromium") {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [points[0]] });
    for (const point of points.slice(1)) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
    await page.mouse.up();
  }
}

async function start(page, level) {
  await page.goto("/clockwork-critters/");
  if (level !== undefined) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
}

async function solveActivity(page, level, step) {
  const prompt = await page.locator("#clock-prompt").textContent();
  if (prompt.startsWith("Set the clock to")) {
    const [, hour, minute] = prompt.match(/to (\d+):(\d\d)/);
    await setHands(page, hour, minute);
    await page.locator("#check-clock").click();
  } else {
    const time = formatTime(buildRound(level)[step].time);
    await page.getByRole("button", { name: time, exact: true }).click();
  }
  await expect(page.locator("#feedback")).toContainText("That's");
}

async function solveQuizQuestion(page, questionIndex) {
  const prompt = await page.locator("#quiz-question-heading + p").textContent();
  if (prompt.startsWith("Set the clock to")) {
    const [, hour, minute] = prompt.match(/to (\d+):(\d\d)/);
    await setHands(page, hour, minute);
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
  await expect(page.locator("#mode-set, #mode-read")).toHaveCount(0);
  await expect(page.locator("#clock-prompt")).toContainText("Set the clock to");
  await expect(page.locator("#clock-description")).toContainText("hour hand is on 12");
  await page.locator("#check-clock").press("Space");
  await expect(page.locator("#feedback")).toContainText("Not quite");
  await expect(page.locator("#clock-hint")).toContainText("minute hand points straight up to 12");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await page.locator("#clock-prompt").focus();
  await page.keyboard.press("Tab");
  await expect(hourHand(page)).toBeFocused();
  for (let step = 0; step < 6; step += 1) await hourHand(page).press("ArrowLeft");
  await expect(hourHand(page)).toBeFocused();
  await expect(page.locator("#clock-description")).toContainText("hour hand is on 6");
  await expect(hourHand(page)).toHaveAttribute("transform", "rotate(180 90 90)");
  await page.keyboard.press("Tab");
  await expect(minuteHand(page)).toBeFocused();
  await page.locator("#check-clock").press("Enter");
  await expect(page.locator("#feedback")).toContainText("That's");
  await expect(page.locator("#next-step")).toBeFocused();
  await expect(hourHand(page)).toHaveAttribute("aria-disabled", "true");
  await hourHand(page).press("ArrowRight");
  await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
  await expectThemedCelebration(page, GAME_CELEBRATIONS["clockwork-critters"]);
  await audit(page);
  await page.locator("#next-step").press("Enter");
  await expect(page.locator("#clock-prompt")).toBeFocused();
  await expect(page.locator("#clock-prompt")).toContainText("What time is shown");
  await expect(page.locator("#check-clock")).toBeHidden();
  await expect(page.locator("#clock-controls")).toBeHidden();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.locator("#clock-description")).toContainText("hour hand is on 7");
  await page.getByRole("button", { name: "6:00", exact: true }).click();
  await expect(page.locator("#feedback")).toContainText("Not quite");
  await expect(page.locator("#clock-hint")).toBeVisible();
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
    const activities = [];
    await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of 4`);
    await expect(page.locator("#level-instructions")).toContainText(
      ["whole hours", "half-hours", "quarter-hours", "five-minute intervals"][level]);
    for (let step = 0; step < 5; step += 1) {
      activities.push((await page.locator("#clock-prompt").textContent()).startsWith("Set") ? "set" : "read");
      await solveActivity(page, level, step);
      if (step === 4 && level < 3) {
        expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
          .toEqual({ version: 1, level: level + 1 });
      }
      await page.locator("#next-step").click();
    }
    expect(activities.filter((mode) => mode === "set")).toHaveLength(2);
    expect(activities.filter((mode) => mode === "read")).toHaveLength(3);
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
  await hourHand(page).press("ArrowRight");
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

test("clock controls reflow with enlarged OpenDyslexic text in normal and quiz modes", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  for (const quiz of [false, true]) {
    if (quiz) {
      await page.goto("/clockwork-critters/?quiz=1");
      await page.getByRole("button", { name: "Start quiz" }).click();
    } else {
      await start(page, 3);
    }
    await page.emulateMedia({ colorScheme: quiz ? "dark" : "light", reducedMotion: "reduce" });
    await page.addStyleTag({ content: `
      :root { font-size: 200%; }
      p, h1, h2, h3, button, summary {
        line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }
    ` });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveClass(/\bopendyslexic\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.getByRole("slider")).toHaveCount(2);
    for (const hit of await page.locator(".clock-hand-hit").all()) {
      const bounds = await hit.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const width = Number.parseFloat(getComputedStyle(node).strokeWidth);
        return { width: box.width + width, height: box.height + width };
      });
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await dragHand(page, "hour", 180);
    await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
    await dragHand(page, "minute", 90, 33);
    await expect(minuteHand(page)).toHaveAttribute("aria-valuenow", "15");
    await audit(page);
    if (quiz) {
      await page.getByRole("button", { name: "Next question" }).click();
    } else {
      await setHands(page, 6, 5);
      await page.locator("#check-clock").click();
      await page.locator("#next-step").click();
    }
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.locator(".clock-choices")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await audit(page);
  }
});

for (const [level, minute] of [[0, 0], [1, 30], [2, 15], [3, 5]]) {
  test(`hands drag directly and snap in level ${level + 1}`, async ({ page }) => {
    await start(page, level);
    await expect(page.getByRole("button", { name: /Move .* hand/ })).toHaveCount(0);
    await page.locator("#check-clock").click();
    await dragHand(page, "hour", 180);
    await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
    await expect(page.locator("#feedback")).toBeEmpty();
    await expect(page.locator("#clock-hint")).toBeHidden();
    if (level === 0) {
      await dragHand(page, "minute", 180, 33);
      await expect(minuteHand(page)).toHaveAttribute("aria-valuenow", "30");
      await page.locator("#check-clock").click();
      await expect(page.locator("#feedback")).toContainText("Not quite");
      await dragHand(page, "minute", 360);
      await expect(minuteHand(page)).toHaveAttribute("aria-valuenow", "0");
      await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "7");
      await dragHand(page, "hour", 180);
    }
    await dragHand(page, "minute", minute * 6 + 2);
    await expect(minuteHand(page)).toHaveAttribute("aria-valuenow", String(minute));
    await expect(hourHand(page)).toHaveAttribute("transform", `rotate(${180 + minute / 2} 90 90)`);
    await page.locator("#check-clock").click();
    await expect(page.locator("#feedback")).toContainText("That's");
    await dragHand(page, "hour", 270);
    await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
  });
}

test("quiz dragging retains revisions without revealing correctness or changing normal progress", async ({ page }) => {
  await page.goto("/clockwork-critters/?quiz=1");
  await page.evaluate((key) => localStorage.setItem(key, '{"version":1,"level":3}'), progressKey);
  await page.reload();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await dragHand(page, "hour", 180);
  await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator(".clockwork-critters > [role=status]"))
    .toHaveText("Answer changed. You can revise it before submitting.");
  await expect(page.locator("#feedback, #clock-hint, .quiz-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
  await dragHand(page, "hour", 210);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "7");
  for (let question = 0; question < 5; question += 1) {
    await page.getByRole("button", { name: "Next question" }).click();
  }
  await dragHand(page, "hour", 180);
  await dragHand(page, "minute", 180);
  await expect(minuteHand(page)).toHaveAttribute("aria-valuenow", "30");
  await expect(hourHand(page)).toHaveAttribute("transform", "rotate(195 90 90)");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(minuteHand(page)).toHaveAttribute("aria-valuenow", "30");
  await expect(hourHand(page)).toHaveAttribute("aria-valuenow", "6");
  await audit(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey))
    .toBe('{"version":1,"level":3}');
});

test("a different random draw starts with reading and then setting at every level", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  for (let level = 0; level < 4; level += 1) {
    await start(page, level);
    await expect(page.locator("#clock-prompt")).toContainText("What time is shown");
    await expect(page.getByRole("slider")).toHaveCount(0);
    await solveActivity(page, level, 0);
    await page.locator("#next-step").click();
    await expect(page.locator("#clock-prompt")).toBeFocused();
    await expect(page.locator("#clock-prompt")).toContainText("Set the clock to");
    await expect(page.getByRole("slider")).toHaveCount(2);
    await solveActivity(page, level, 1);
  }
  await page.goto("/clockwork-critters/?quiz=1");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.locator("#quiz-question-heading + p")).toContainText("What time is shown");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.locator("#quiz-question-heading + p")).toContainText("Set the clock to");
  await expect(page.getByRole("slider")).toHaveCount(2);
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.locator("#quiz-question-heading + p")).toContainText("What time is shown");
});

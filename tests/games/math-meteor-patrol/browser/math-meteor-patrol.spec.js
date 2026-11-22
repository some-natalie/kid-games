import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GAME_CELEBRATIONS } from "../../../../static/game-celebrations.js";
import { expectThemedCelebration } from "../../shared/celebrations.js";

const celebrations = GAME_CELEBRATIONS["math-meteor-patrol"];

function answerFor(equation) {
  const [, left, operation, right] = equation.match(/^(\d+) ([+−×]) (\d+) = \?$/);
  return operation === "+" ? Number(left) + Number(right)
    : operation === "−" ? Number(left) - Number(right) : Number(left) * Number(right);
}

async function audit(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test("worked example leads to editable untimed practice with keyboard and touch answers", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/math-meteor-patrol/");
  await expect(page.getByRole("heading", { name: "Worked example: 2 + 3 = ?" })).toBeVisible();
  await expect(page.locator("#mode-description")).toContainText("no countdown");
  await expect(page.locator("#tutorial")).toContainText("before play");
  await page.locator("#operation").selectOption("multiplication");
  await page.locator("#start-game").click();
  await expect(page.locator("#target-label")).toContainText("multiplication");
  await expect(page.locator("#timer-panel")).toBeHidden();
  await expect(page.locator("#answer")).toBeFocused();
  const equation = await page.locator("#equation").textContent();
  const answer = answerFor(equation);
  const wrong = (answer + 1) % 21;
  await page.locator("#answer").fill(String(wrong));
  await page.getByRole("button", { name: "Zap meteor" }).click();
  await expect(page.locator("#feedback")).toContainText("try again");
  await expect(page.locator("#feedback")).not.toContainText(`= ${answer}`);
  await expect(page.locator("#answer")).toHaveValue(String(wrong));
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator("#meteor-shot")).toBeHidden();
  await expect(page.locator("#meteor-card")).toBeVisible();
  await expect(page.locator("#meteor-card")).toHaveText("☄️");
  const meteorSize = await page.locator("#meteor-card").boundingBox();
  const shieldSize = await page.locator("#meteor-shield").boundingBox();
  expect(meteorSize.width).toBeGreaterThan(shieldSize.width);
  if (test.info().project.name === "touch-chromium") {
    await page.getByRole("button", { name: "Clear", exact: true }).tap();
    for (const digit of String(answer)) await page.getByRole("button", { name: digit, exact: true }).tap();
    await page.getByRole("button", { name: "Zap meteor" }).tap();
  } else {
    await page.locator("#answer").fill(String(answer));
    await page.locator("#answer").press("Enter");
  }
  await expect(page.locator("#feedback")).toContainText("Correct!");
  await expect(page.locator("#next-meteor")).toBeVisible();
  await expect(page.locator("#meteor-card")).toBeHidden();
  await expect(page.locator("#meteor-shot")).toBeVisible();
  await expect(page.locator("#meteor-shot")).toContainText("pew!");
  await expect(page.locator("#meteor-shot")).toHaveAttribute("aria-hidden", "true");
  expect(await page.locator("#meteor-shot").evaluate((shot) => shot.getAnimations().length)).toBe(0);
  await expectThemedCelebration(page, celebrations);
  await expect(page.locator("#meteor-lane .celebration")).toHaveAttribute("data-effect", "meteor-sparkles");
  expect(await page.locator(".celebration").evaluate((layer) => layer.getAnimations({ subtree: true }).length)).toBe(0);
  await audit(page);
  await page.locator("#next-meteor").click();
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator("#meteor-shot")).toBeHidden();
  await expect(page.locator("#wave-label")).toHaveText("Meteor 2");
});

test("gentle and challenge timing can be paused and hidden tabs suspend the countdown", async ({ page }) => {
  await page.clock.install();
  await page.goto("/math-meteor-patrol/");
  await page.locator("#mode").selectOption("gentle");
  await page.locator("#operation").selectOption("subtraction");
  await expect(page.locator("#mode-description")).toContainText("18 seconds");
  await page.locator("#start-game").click();
  await expect(page.locator("#countdown")).toHaveText("18 seconds remain");
  await expect(page.locator("#target-label")).toContainText("subtraction");
  await page.locator("#pause-game").click();
  await expect(page.locator("#resume-game")).toBeVisible();
  const paused = await page.locator("#time-left").evaluate((meter) => meter.value);
  await page.clock.runFor(350);
  expect(await page.locator("#time-left").evaluate((meter) => meter.value)).toBe(paused);
  await page.locator("#resume-game").click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#suspension-note")).toBeVisible();
  const hiddenProgress = await page.locator("#time-left").evaluate((meter) => meter.value);
  await page.clock.runFor(1000);
  expect(await page.locator("#time-left").evaluate((meter) => meter.value)).toBe(hiddenProgress);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#suspension-note")).toBeHidden();
  await page.clock.runFor(100);
  const resumedProgress = await page.locator("#time-left").evaluate((meter) => meter.value);
  expect(resumedProgress).toBeLessThan(hiddenProgress);
  expect(resumedProgress).toBeGreaterThan(hiddenProgress - 0.02);
  await page.locator("#end-game").click();
  await expect(page.locator("#quest-heading")).toBeFocused();

  await page.goto("/math-meteor-patrol/");
  await page.locator("#mode").selectOption("challenge");
  await expect(page.locator("#mode-description")).toContainText("12 seconds");
  await page.locator("#start-game").click();
  await expect(page.locator("#countdown")).toHaveText("12 seconds remain");
  await page.locator("#pause-game").click();
  await expect(page.locator("#resume-game")).toBeVisible();
  await page.locator("#end-game").click();
});

test("reduced motion keeps the meteor stationary and provides countdown feedback", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/math-meteor-patrol/");
  await page.locator("#mode").selectOption("gentle");
  await page.locator("#start-game").click();
  await expect(page.locator("#play-area")).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.locator("#countdown")).toBeVisible();
  const top = await page.locator("#meteor-card").evaluate((card) => card.style.top);
  await page.clock.runFor(2000);
  expect(await page.locator("#meteor-card").evaluate((card) => card.style.top)).toBe(top);
  await audit(page);
});

test("saved target and mode stay local and restore on return", async ({ page }) => {
  await page.goto("/math-meteor-patrol/");
  await page.locator("#operation").selectOption("multiplication");
  await page.locator("#mode").selectOption("gentle");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kid-games.math-meteor-patrol.preferences"))))
    .toEqual({ version: 1, mode: "gentle", operation: "multiplication" });
  await page.reload();
  await expect(page.locator("#operation")).toHaveValue("multiplication");
  await expect(page.locator("#mode")).toHaveValue("gentle");
  await expect(page.locator("#preference-status")).toContainText("saved only in this browser");
});

test("number controls reflow with OpenDyslexic and enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await page.goto("/math-meteor-patrol/");
  await page.locator("#start-game").click();
  await page.addStyleTag({ content: `
    :root { font-size: 200%; }
    p, h1, h2, h3, button, label { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
    p { margin-bottom: 2em !important; }
  `   });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of await page.locator("#number-pad button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
});

for (const mode of ["practice", "gentle"]) {
  test(`landscape ${mode} keeps the meteor visible beside scrollable answers`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.emulateMedia({ reducedMotion: mode === "practice" ? "reduce" : "no-preference", colorScheme: "dark" });
    await page.goto("/math-meteor-patrol/");
    await page.locator("#mode").selectOption(mode);
    await page.locator("#start-game").click();
    const lane = page.locator("#meteor-lane");
    const controls = await page.locator(".meteor-controls").boundingBox();
    const laneBounds = await lane.boundingBox();
    expect(laneBounds.x + laneBounds.width).toBeLessThan(controls.x);
    const initialMeteor = await page.locator("#meteor-card").boundingBox();
    expect(initialMeteor.y).toBeGreaterThanOrEqual(0);
    expect(initialMeteor.y + initialMeteor.height).toBeLessThanOrEqual(390);
    for (const control of ["#answer", "#number-pad button:last-child"]) {
      await page.locator(control).focus();
      await page.locator(control).scrollIntoViewIfNeeded();
      for (const selector of ["#meteor-card", "#meteor-shield"]) {
        const bounds = await page.locator(selector).boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(390);
      }
    }
    await audit(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const portraitLane = await lane.boundingBox();
    const portraitControls = await page.locator(".meteor-controls").boundingBox();
    expect(portraitLane.y + portraitLane.height).toBeLessThanOrEqual(portraitControls.y);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addStyleTag({ content: ":root { font-size: 200%; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
  });
}

test("a missed timed meteor shows its equation and strategy before the next wave", async ({ page }) => {
  await page.clock.install();
  await page.goto("/math-meteor-patrol/");
  await page.locator("#mode").selectOption("challenge");
  await page.locator("#start-game").click();
  const equation = await page.locator("#equation").textContent();
  await page.clock.runFor(12000);
  await expect(page.locator("#feedback")).toContainText("The correct equation is");
  await expect(page.locator("#feedback")).toContainText(equation.replace(" = ?", ` = ${answerFor(equation)}`));
  await expect(page.locator("#feedback")).toContainText(/count on|count back|groups/);
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator("#meteor-shot")).toBeHidden();
  const card = await page.locator("#meteor-card").boundingBox();
  const shield = await page.locator(".meteor-shield").boundingBox();
  expect(card.y + card.height).toBeLessThanOrEqual(shield.y + 2);
  await page.clock.runFor(2500);
  await expect(page.locator("#wave-label")).toHaveText("Meteor 2");
});

test("a falling meteor explodes into sparkles at its position and leaves a short breather", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await page.goto("/math-meteor-patrol/");
  await page.clock.pauseAt(new Date());
  await page.locator("#mode").selectOption("gentle");
  await page.locator("#start-game").click();
  const start = await page.locator("#meteor-card").boundingBox();
  const equationBounds = await page.locator("#equation").boundingBox();
  await page.clock.runFor(6000);
  const falling = await page.locator("#meteor-card").boundingBox();
  expect(falling.y).toBeGreaterThan(start.y + 40);
  expect(falling.x).toBe(start.x);
  expect(await page.locator("#equation").boundingBox()).toEqual(equationBounds);
  await page.locator("#pause-game").click();
  const paused = await page.locator("#meteor-card").boundingBox();
  await page.clock.runFor(1000);
  expect(await page.locator("#meteor-card").boundingBox()).toEqual(paused);
  await page.locator("#resume-game").click();
  const meteorTop = await page.locator("#meteor-card").evaluate((card) => Number.parseFloat(card.style.top));
  const equation = await page.locator("#equation").textContent();
  await page.locator("#answer").fill(String(answerFor(equation)));
  await page.locator("#answer").press("Enter");
  await expect(page.locator("#meteor-card")).toBeHidden();
  const shot = page.locator("#meteor-shot");
  await expect(shot).toBeVisible();
  expect(await shot.evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
  const trajectory = await shot.evaluate((node) => ({
    start: Number.parseFloat(node.style.top),
    travel: Number.parseFloat(node.style.getPropertyValue("--shot-travel")),
    shield: node.parentElement.clientHeight - document.getElementById("meteor-shield").offsetHeight,
  }));
  expect(trajectory.start).toBe(trajectory.shield);
  expect(Math.abs(trajectory.start + trajectory.travel - meteorTop)).toBeLessThan(2);
  await expectThemedCelebration(page, celebrations);
  const burst = page.locator("#meteor-lane .celebration-local");
  await expect(burst).toHaveAttribute("data-effect", "meteor-sparkles");
  const origin = await burst.evaluate((layer) => ({
    top: Number.parseFloat(layer.style.top), left: Number.parseFloat(layer.style.left),
    center: layer.parentElement.clientWidth / 2,
  }));
  expect(Math.abs(origin.left - origin.center)).toBeLessThan(2);
  expect(Math.abs(origin.top - meteorTop)).toBeLessThan(2);
  expect(await burst.evaluate((layer) => layer.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await expect(page.locator("#feedback")).toContainText("burst into sparkles");
  await page.clock.runFor(1000);
  await expect(page.locator("#wave-label")).toHaveText("Meteor 1");
  await page.clock.runFor(500);
  await expect(page.locator("#wave-label")).toHaveText("Meteor 2");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(shot).toBeHidden();
});

test("quiz mode hides the example, retains revisions, and grades only after submission", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kid-games.math-meteor-patrol.preferences", "unchanged"));
  await page.goto("/math-meteor-patrol/?quiz=1");
  await expect(page.locator(".quiz-notice")).toContainText("change your answers");
  await expect(page.locator(".math-meteor-patrol")).not.toContainText("Worked example");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.locator("#meteor-lane, #meteor-shot, .celebration")).toHaveCount(0);
  await audit(page);
  const firstEquation = await page.locator(".quiz-question-heading, #quiz-question-heading").textContent();
  const firstPrompt = await page.locator("#quiz-question-heading + p").textContent();
  const wrong = (answerFor(firstPrompt) + 1) % 21;
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill(String(wrong));
  await expect(page.locator("#quest-complete")).toHaveCount(0);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(input).toHaveValue(String(wrong));
  await expect(page.locator("#quiz-question-heading")).toHaveText(firstEquation);
  await input.fill(String(answerFor(firstPrompt)));
  for (let question = 0; question < 11; question += 1) {
    const prompt = await page.locator("#quiz-question-heading + p").textContent();
    await page.getByRole("textbox", { name: "Your answer" }).fill(String(answerFor(prompt)));
    if (question < 10) await page.getByRole("button", { name: "Next question" }).click();
    else await page.getByRole("button", { name: "Review answers" }).first().click();
  }
  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();
  await audit(page);
  await expect(page.locator(".quiz-review li")).toHaveCount(11);
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator("#quest-complete")).toContainText("100% correct (11 of 11 questions)");
  await expect(page.getByText("Answer details")).toBeVisible();
  await audit(page);
  expect(await page.evaluate(() => localStorage.getItem("kid-games.math-meteor-patrol.preferences"))).toBe("unchanged");
});

test("blocked local storage reports the failure and keeps play available", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.goto("/math-meteor-patrol/");
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#equation")).toBeVisible();
});

for (const colorScheme of ["light", "dark"]) {
  test(`practice setup and gameplay pass accessibility checks in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/math-meteor-patrol/");
    await audit(page);
    await page.locator("#start-game").click();
    await audit(page);
  });
}

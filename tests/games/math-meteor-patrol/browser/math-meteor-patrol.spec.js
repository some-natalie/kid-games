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
  await expectThemedCelebration(page, celebrations);
  await page.locator("#next-meteor").click();
  await expect(page.locator("#wave-label")).toHaveText("Meteor 2");
});

test("gentle and challenge timing can be paused and hidden tabs suspend the countdown", async ({ page }) => {
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
  await page.waitForTimeout(350);
  expect(await page.locator("#time-left").evaluate((meter) => meter.value)).toBe(paused);
  await page.locator("#resume-game").click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#suspension-note")).toBeVisible();
  const hiddenProgress = await page.locator("#time-left").evaluate((meter) => meter.value);
  await page.waitForTimeout(1000);
  expect(await page.locator("#time-left").evaluate((meter) => meter.value)).toBe(hiddenProgress);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#suspension-note")).toBeHidden();
  await page.waitForTimeout(100);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/math-meteor-patrol/");
  await page.locator("#mode").selectOption("gentle");
  await page.locator("#start-game").click();
  await expect(page.locator("#play-area")).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.locator("#countdown")).toBeVisible();
  expect(await page.locator("#meteor-card").evaluate((card) => card.style.left)).toBe("50%");
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
  await page.clock.runFor(2500);
  await expect(page.locator("#wave-label")).toHaveText("Meteor 2");
});

test("a correct timed answer clears the meteor and leaves a short breather", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/math-meteor-patrol/");
  await page.locator("#mode").selectOption("gentle");
  await page.locator("#start-game").click();
  const equation = await page.locator("#equation").textContent();
  await page.locator("#answer").fill(String(answerFor(equation)));
  await page.locator("#answer").press("Enter");
  await expect(page.locator("#meteor-card")).toBeHidden();
  await page.clock.runFor(1000);
  await expect(page.locator("#wave-label")).toHaveText("Meteor 1");
  await page.clock.runFor(500);
  await expect(page.locator("#wave-label")).toHaveText("Meteor 2");
});

test("quiz mode hides the example, retains revisions, and grades only after submission", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kid-games.math-meteor-patrol.preferences", "unchanged"));
  await page.goto("/math-meteor-patrol/?quiz=1");
  await expect(page.locator(".quiz-notice")).toContainText("change your answers");
  await expect(page.locator(".math-meteor-patrol")).not.toContainText("Worked example");
  await page.getByRole("button", { name: "Start quiz" }).click();
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

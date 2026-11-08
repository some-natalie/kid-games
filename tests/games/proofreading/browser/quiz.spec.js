import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LEVELS as NUMBER_LEVELS, buildRound as numberRound } from "../../../../static/number-trail-engine.js";
import { LEVELS as ACORN_LEVELS, buildJourney } from "../../../../static/acorn-adventure-engine.js";
import { LEVELS as PROOF_LEVELS } from "../../../../static/proofreading-levels.js";
import { buildRound as proofRound, tokenKey } from "../../../../static/proofreading-engine.js";
const notice = "You'll see how you did at the end.";
async function start(page, path) {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(`${path}?quiz=1`);
  await expect(page.getByRole("button", { name: "Start quiz", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Start quiz", exact: true }).click();
}
async function audit(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
}

test("quiz URL propagates between home and games, but other values keep normal play", async ({ page }) => {
  await page.goto("/?quiz=1");
  await expect(page.locator(".quiz-notice")).toContainText(notice);
  await page.getByRole("link", { name: /Number Trail/ }).click();
  await expect(page).toHaveURL(/\/number-trail\/\?quiz=1$/);
  await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();
  await page.getByRole("link", { name: "← All games" }).click();
  await expect(page).toHaveURL(/\?quiz=1$/);
  await page.goto("/number-trail/?quiz=0");
  await expect(page.locator("#start-game")).toBeVisible();
  await expect(page.locator(".quiz-notice")).toHaveCount(0);
  const quizRequests = [];
  page.on("request", (request) => {
    if (/\/quiz-mode\.js/.test(request.url())) quizRequests.push(request.url());
  });
  await page.goto("/?quiz=0");
  await expect(page.getByRole("link", { name: /Number Trail/ })).toBeVisible();
  expect(quizRequests).toEqual([]);
});

test("quiz loading errors are visible and never expose the normal tutorial", async ({ page }) => {
  await page.route("**/quiz-mode.js", (route) => route.abort());
  await page.goto("/number-trail/?quiz=1");
  await expect(page.getByRole("alert")).toHaveText("We couldn't load quiz mode. Reload the page to try again.");
  await expect(page.locator("#tutorial")).toBeHidden();
});

test("number quiz withholds grading, permits revisions, and scores the final responses only", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem("kid-games.number-trail.progress", '{"version":1,"level":7}'));
  await start(page, "/number-trail/");
  await expect(page.locator(".quiz-notice")).toContainText(notice);
  await expect(page.locator("#show-hint")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Check/ })).toHaveCount(0);
  const questions = NUMBER_LEVELS.flatMap((_, index) => numberRound(index, () => 0));
  const first = questions[0];
  const wrong = first.choices.find((value) => value !== first.answer);
  await page.getByRole("button", { name: String(wrong), exact: true }).click();
  await expect(page.locator('.alphabet-game [role="status"]')).toHaveText("Answer selected. You can change it before submitting.");
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("button", { name: String(wrong), exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: String(first.answer), exact: true }).click();
  for (let index = 0; index < questions.length; index += 1) {
    if (index > 0) await page.getByRole("button", { name: String(questions[index].answer), exact: true }).click();
    await page.getByRole("button", { name: index === questions.length - 1 ? "Review answers" : "Next question", exact: true }).click();
  }
  await expect(page.locator(".quiz-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit question 1", exact: true }).click();
  await page.getByRole("button", { name: String(wrong), exact: true }).click();
  await page.getByRole("button", { name: "Review answers", exact: true }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expect(page.locator(".quiz-score")).toHaveText("98% correct (49 of 50 questions)");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText(`Your answer: ${wrong}`);
  await expect(page.locator("#quest-complete details")).toContainText("Correct equation:");
  expect(await page.evaluate(() => localStorage.getItem("kid-games.number-trail.progress"))).toBe('{"version":1,"level":7}');
});

test("Acorn quiz carries entered totals without revealing correct totals or fixing earlier answers", async ({ page }) => {
  test.slow();
  await start(page, "/acorn-adventure/");
  const input = page.getByRole("spinbutton", { name: "Your new basket total" });
  await input.fill("-1");
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await expect(page.locator(".alphabet-game [role=status]")).toHaveText("Enter a whole number of nuts, zero or more.");
  await input.fill("1.5");
  await page.getByRole("button", { name: "Review answers", exact: true }).click();
  await expect(page.locator(".alphabet-game [role=status]")).toHaveText("Enter whole numbers of nuts, zero or more, before reviewing.");
  await input.fill("99");
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await expect(page.getByText("Your carried total: 99 nuts.", { exact: true })).toBeVisible();
  await input.fill("98");
  await page.getByRole("button", { name: "Previous question" }).click();
  await input.fill("8");
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await expect(page.getByText("Your carried total: 8 nuts.", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("98");
  await expect(page.locator(".success")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
  await audit(page);
});

test("Acorn quiz accepts a correct full journey and keeps grading hidden until submission", async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, "/acorn-adventure/");
  const steps = ACORN_LEVELS.flatMap((_, index) => buildJourney(index, () => 0).steps);
  for (const [index, step] of steps.entries()) {
    await page.getByRole("spinbutton").fill(String(step.total));
    await page.getByRole("button", { name: index === steps.length - 1 ? "Review answers" : "Next question", exact: true }).click();
  }
  await expect(page.locator(".quiz-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText(`100% correct (${steps.length} of ${steps.length} questions)`);
  await expect(page.locator(".celebration")).toHaveCount(0);
  await audit(page);
});

test("proofreading quiz never fixes marks early and reports missed mistakes and false marks at the end", async ({ page }) => {
  test.slow();
  await start(page, "/proofreading/");
  const expectedRound = proofRound({ sentences: PROOF_LEVELS[0].variants[0] });
  const expected = expectedRound.sentences.flatMap((sentence, s) => sentence.tokens.flatMap((token, t) =>
    token.kind === "mistake" ? [tokenKey(s, t)] : []));
  const tokens = expectedRound.sentences.flatMap((sentence) => sentence.tokens.filter((token) => token.kind !== "space"));
  const wrong = tokens.findIndex((token) => token.kind === "word");
  const targets = page.locator(".proof-token");
  await targets.nth(wrong).click();
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(targets.nth(wrong)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-result], .proof-change")).toHaveCount(0);
  await expect(page.locator("#level-hint, #fixes, #check-example")).toHaveCount(0);
  await page.getByRole("button", { name: "Review answers", exact: true }).click();
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("0% correct (0 of 10 questions)");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText(`Mistakes missed: ${expected.length}. Correct items marked by mistake: 1.`);
  await audit(page);
});

test("alphabet quiz retains edited orders, removes reference hints, and grades whole lists only at the end", async ({ page }) => {
  test.slow();
  await start(page, "/alphabetical-order/");
  await expect(page.locator(".quiz-words li > span")).toHaveCount(4);
  await expect(page.locator(".alphabet-rail, #level-hint, .hint-badge")).toHaveCount(0);
  await page.locator(".quiz-words li").last().getByRole("button", { name: /Move .* up/ }).click();
  const revised = await page.locator(".quiz-words li > span").allTextContents();
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.locator(".quiz-words li > span")).toHaveText(revised);
  const ordered = [...revised].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  for (const word of [...ordered].reverse()) {
    let index = (await page.locator(".quiz-words li > span").allTextContents()).indexOf(word);
    while (index > 0) {
      await page.getByRole("button", { name: `Move ${word} up`, exact: true }).click();
      index -= 1;
    }
  }
  await page.getByRole("button", { name: "Review answers", exact: true }).click();
  const submittedOrders = (await page.locator(".quiz-review li p").allTextContents())
    .map((text) => text.split(": ").at(-1).split(", "));
  const correctCount = submittedOrders.filter((words) => {
    const sorted = [...words].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    return words.every((word, index) => word === sorted[index]);
  }).length;
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText(`${correctCount * 10}% correct (${correctCount} of 10 questions)`);
  await expect(page.locator(".celebration")).toHaveCount(0);
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details li").first()).toContainText("Correct");
  await expect(page.locator("#quest-complete details")).toContainText("Correct order:");
  await audit(page);
});

test("quiz pages and results reflow with enlarged OpenDyslexic text in dark mode", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await page.addInitScript(() => {
    for (const key of ["kid-games.number-trail.progress", "kid-games.acorn-adventure.progress",
      "kid-games.proofreading.progress", "kid-games.alphabetical-order.progress"]) {
      localStorage.setItem(key, "saved normal-game progress");
    }
  });
  for (const path of ["/number-trail/", "/acorn-adventure/", "/proofreading/", "/alphabetical-order/"]) {
    await page.goto(`${path}?quiz=1`);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByRole("button", { name: "Start quiz" }).click();
    await page.addStyleTag({ content: ":root { font-size:200%; } p, li, h2, button, label { letter-spacing:.12em; word-spacing:.16em; line-height:1.5; }" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole("button", { name: "Review answers", exact: true }).click();
    await page.getByRole("button", { name: "Submit quiz" }).click();
    await page.getByText("Answer details", { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await audit(page);
    for (const key of ["kid-games.number-trail.progress", "kid-games.acorn-adventure.progress",
      "kid-games.proofreading.progress", "kid-games.alphabetical-order.progress"]) {
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe("saved normal-game progress");
    }
  }
});

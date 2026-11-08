import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { buildRound, tokenKey } from "../../../../static/proofreading-engine.js";
import { LEVELS } from "../../../../static/proofreading-levels.js";

const audit = async (page) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
};

for (const colorScheme of ["light", "dark"]) {
  test(`pages and active games pass automated WCAG checks in ${colorScheme} mode`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const path of ["/", "/alphabetical-order/", "/proofreading/", "/number-trail/", "/acorn-adventure/"]) {
      await page.goto(path);
      await expect(page.getByRole("checkbox", { name: "Use OpenDyslexic font" })).toBeVisible();
      await audit(page);
      if (path !== "/") {
        await expect(page.locator("#start-game")).toBeEnabled();
        await page.locator("#start-game").click();
        await audit(page);
      }
    }
  });
}

test("proofreading errors, corrections, and completion remain accessible without a reading timeout", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto("/proofreading/");
  await page.evaluate(() => localStorage.setItem("kid-games.proofreading.progress", JSON.stringify({ version: 1, level: 9 })));
  await page.reload();
  await page.locator("#start-game").click();
  const round = buildRound({ sentences: LEVELS[9].variants[0] });
  const targets = round.sentences.flatMap((sentence, s) => sentence.tokens.flatMap((token, t) =>
    token.kind === "mistake" ? [tokenKey(s, t)] : []));
  await page.locator(`[data-token="${targets[0]}"]`).click();
  await page.locator("#check-marks").click();
  await audit(page);
  for (const key of targets.slice(1)) await page.locator(`[data-token="${key}"]`).click();
  await page.locator("#check-marks").click();
  await expect(page.locator("#finish-case")).toBeFocused();
  await page.waitForTimeout(4500);
  await expect(page.locator("#fixes")).toBeVisible();
  await expect(page.locator("#quest-complete")).toBeHidden();
  await audit(page);
  await page.locator("#finish-case").press("Enter");
  await expect(page.locator("#quest-heading")).toBeFocused();
  await audit(page);
});

test("alphabet hints and the completed quest pass automated accessibility checks", async ({ page }) => {
  test.slow();
  await page.goto("/alphabetical-order/");
  await page.evaluate(() => localStorage.setItem("kid-games.alphabetical-order.progress",
    JSON.stringify({ version: 1, themes: { general: { level: 9 } } })));
  await page.reload();
  await expect(page.locator("#start-game")).toBeEnabled();
  await page.locator("#start-game").click();
  const buttons = page.locator("#answer-list .word-button");
  const words = await buttons.evaluateAll((items) => items.map((item) => item.lastChild.textContent));
  for (const word of [...words].sort().reverse()) {
    const current = await buttons.evaluateAll((items) => items.map((item) => item.lastChild.textContent));
    await buttons.nth(current.indexOf(word)).press("Home");
  }
  await buttons.first().press("End");
  await page.locator("#check-order").click();
  await expect(page.locator(".hint-badge")).not.toHaveCount(0);
  await audit(page);
  await buttons.last().press("Home");
  await page.locator("#check-order").click();
  await expect(page.locator("#quest-complete")).toBeVisible();
  await expect(page.locator("#quest-heading")).toBeFocused();
  await audit(page);
});

test("skip links move keyboard focus into content on every page", async ({ page }) => {
  for (const path of ["/", "/alphabetical-order/", "/proofreading/", "/number-trail/", "/acorn-adventure/"]) {
    await page.goto(path);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  }
});

test("pages and games reflow at 320px with enlarged text and custom text spacing", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  for (const path of ["/", "/alphabetical-order/", "/proofreading/", "/number-trail/", "/acorn-adventure/"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: `
      :root { font-size: 200%; }
      p, h1, h2, h3, a, button, label, select {
        line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }
    ` });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    if (path !== "/") {
      await page.locator("#start-game").click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
  }
});

test("victory animations stop within five seconds and reduced motion disables them", async ({ page }) => {
  for (const path of ["/alphabetical-order/", "/proofreading/"]) {
    await page.goto(path);
    const scenes = await page.locator("[data-victory-scene]").evaluateAll((items) =>
      items.map((item) => item.dataset.victoryScene));
    if (path === "/alphabetical-order/") expect(scenes).toHaveLength(10);
    for (const scene of scenes.length ? scenes : [null]) {
      await page.evaluate((selected) => {
        const finale = document.querySelector("#quest-complete");
        finale.hidden = false;
        for (const item of finale.querySelectorAll("[data-victory-scene]")) {
          item.toggleAttribute("hidden", item.dataset.victoryScene !== selected);
        }
      }, scene);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const animations = await page.locator("#quest-complete").evaluate((el) =>
        el.getAnimations({ subtree: true }).map((animation) => animation.effect.getTiming()));
      expect(animations.length).toBeGreaterThan(0);
      for (const timing of animations) {
        expect(timing.iterations * timing.duration + Math.max(0, timing.delay)).toBeLessThanOrEqual(5000);
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await page.locator("#quest-complete").evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    }
  }
});

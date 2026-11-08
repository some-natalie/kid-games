import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GROUPS_PROGRESS, createWorkspace } from "../../../../static/alphabet-groups-engine.js";

const progressKey = "kid-games.alphabetical-order.progress";
const preferencesKey = "kid-games.alphabetical-order.preferences";
const sample = ["cart", "cat", "car", "book", "banana", "apple"];
const classicSave = { level: 4 };
const preferences = JSON.stringify({ version: 1, theme: "dinosaurs" });
const board = (page, id) => page.locator(`[data-list="${id}"]`);
const listed = (page, id) => board(page, id).locator("[data-word]").evaluateAll((items) => items.map((item) => item.dataset.word));

async function activate(control) {
  if (test.info().project.name === "touch-chromium") await control.tap();
  else await control.press("Enter");
}

async function openSample(page) {
  await page.goto("/");
  await page.evaluate(({ progressKey, preferencesKey, preferences, state }) => {
    localStorage.setItem(progressKey, JSON.stringify(state));
    localStorage.setItem(preferencesKey, preferences);
  }, { progressKey, preferencesKey, preferences, state: {
    version: 1, themes: { general: classicSave, [GROUPS_PROGRESS]: {
      level: 0, roundWords: sample, workspace: createWorkspace(sample),
    } },
  } });
  await page.goto("/alphabetical-order/?sort=groups");
  await expect(page.locator("#start-game")).toBeEnabled();
  await activate(page.locator("#start-game"));
}

async function createList(page, name, depth = 1) {
  await page.getByLabel("New list name", { exact: true }).fill(name);
  await page.getByLabel("Compare letter in the new list", { exact: true }).selectOption(String(depth));
  await activate(page.getByRole("button", { name: "Create working list", exact: true }));
}

async function move(page, word, destination) {
  await activate(page.getByRole("button", { name: new RegExp(`^Select ${word},`) }));
  await page.getByLabel(`Move ${word} to`, { exact: true }).selectOption(destination);
  await activate(page.getByRole("button", { name: "Move selected word", exact: true }));
  await expect(board(page, destination).locator(`[data-word="${word}"]`)).toBeFocused();
}

async function sortList(page, id) {
  const ordered = (await listed(page, id)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  for (const word of [...ordered].reverse()) await board(page, id).locator(`[data-word="${word}"]`).press("Home");
  expect(await listed(page, id)).toEqual(ordered);
  return ordered;
}

async function audit(page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
}

test("children refine first, second, third, and fourth-letter lists and assemble the final order", async ({ page }) => {
  test.slow();
  await openSample(page);
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.getByRole("button", { name: "Check order", exact: true })).toBeVisible();
  await activate(page.getByRole("button", { name: "Check order", exact: true }));
  await expect(page.locator("#feedback")).toContainText("Gather every word");
  await expect(page.locator("#feedback")).not.toContainText("right place");

  await createList(page, "c");
  for (const word of ["cart", "cat", "car"]) await move(page, word, "group-1");
  await board(page, "group-1").getByLabel("Compare letter in c", { exact: true }).selectOption("2");
  await createList(page, "ca", 3);
  for (const word of ["cart", "cat", "car"]) await move(page, word, "group-2");
  await createList(page, "car", 4);
  for (const word of ["cart", "car"]) await move(page, word, "group-3");
  await createList(page, "cat", 3);
  await move(page, "cat", "group-4");
  await expect(board(page, "group-3").locator('[data-word="car"] .comparison-letter')).toContainText("end of word");
  await expect(board(page, "group-3").locator('[data-word="cart"] .comparison-letter')).toHaveText("t");
  await sortList(page, "group-3");
  await sortList(page, "tray");
  await audit(page);

  await page.reload();
  await activate(page.locator("#start-game"));
  expect(await listed(page, "group-3")).toEqual(["car", "cart"]);
  await expect(board(page, "group-3").getByLabel("Compare letter in car", { exact: true })).toHaveValue("4");
  await activate(page.getByRole("button", { name: "Send Word tray to final ABC list", exact: true }));
  await activate(page.getByRole("button", { name: "Send car to final ABC list", exact: true }));
  await activate(page.getByRole("button", { name: "Undo workspace move", exact: true }));
  expect(await listed(page, "group-3")).toEqual(["car", "cart"]);
  expect(await listed(page, "final")).toEqual(["apple", "banana", "book"]);
  await activate(page.getByRole("button", { name: "Send car to final ABC list", exact: true }));
  await activate(page.getByRole("button", { name: "Send cat to final ABC list", exact: true }));
  expect(await listed(page, "final")).toEqual(["apple", "banana", "book", "car", "cart", "cat"]);
  await activate(page.getByRole("button", { name: "Check order", exact: true }));
  await expect(page.locator("#feedback")).toContainText("Every word is in the right place");
  await expect(page.getByRole("button", { name: "Next level", exact: true })).toBeFocused();
  await expect(board(page, "final").locator("[data-word]").first()).toBeDisabled();
  await audit(page);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey);
  expect(saved.themes.general).toEqual(classicSave);
  expect(saved.themes[GROUPS_PROGRESS].level).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), preferencesKey)).toBe(preferences);
});

test("list validation, wrong final orders, revisions, and clearing empty groups remain editable", async ({ page }) => {
  await openSample(page);
  await activate(page.getByRole("button", { name: "Create working list", exact: true }));
  await expect(page.getByLabel("New list name", { exact: true })).toBeFocused();
  await expect(page.locator(".group-workspace-status")).toHaveText("Give your working list a name.");
  await createList(page, "c");
  await createList(page, "C");
  await expect(page.locator(".group-workspace-status")).toHaveText("Choose a different name for each working list.");
  await activate(page.getByRole("button", { name: "Send Word tray to final ABC list", exact: true }));
  await activate(page.getByRole("button", { name: "Check order", exact: true }));
  await expect(page.locator("#feedback")).toContainText("try again");
  await move(page, "car", "group-1");
  await expect(page.getByRole("button", { name: "Remove empty list c", exact: true })).toBeDisabled();
  await move(page, "car", "final");
  await activate(page.getByRole("button", { name: "Remove empty list c", exact: true }));
  await expect(board(page, "group-1")).toHaveCount(0);
  await sortList(page, "final");
  await activate(page.getByRole("button", { name: "Check order", exact: true }));
  await expect(page.locator("#feedback")).toHaveClass(/success/);
});

test("success feedback keeps full contrast at the first animation frame in light and dark modes", async ({ page }) => {
  test.slow();
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme, reducedMotion: "no-preference" });
    await openSample(page);
    await activate(page.getByRole("button", { name: "Send Word tray to final ABC list", exact: true }));
    await sortList(page, "final");
    await activate(page.getByRole("button", { name: "Check order", exact: true }));
    const animations = await page.locator("#feedback").evaluate((feedback) => {
      const animations = feedback.getAnimations();
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 0;
      }
      return animations.length;
    });
    expect(animations).toBe(1);
    await expect(page.locator("#feedback")).toHaveCSS("opacity", "1");
    await audit(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#feedback")).toHaveCSS("animation-name", "none");
    await expect(page.locator("#feedback")).toHaveCSS("opacity", "1");
    await audit(page);
  }
});

test("all seven deeper-letter rounds complete, and the finale clears only group progress", async ({ page }) => {
  test.slow();
  await openSample(page);
  for (let level = 0; level < 7; level += 1) {
    await expect(page.locator("#level-count")).toHaveText(`Level ${level + 1} of 7`);
    await activate(page.getByRole("button", { name: "Send Word tray to final ABC list", exact: true }));
    await sortList(page, "final");
    await activate(page.getByRole("button", { name: "Check order", exact: true }));
    await activate(page.getByRole("button", { name: level < 6 ? "Next level" : "Finish sorting", exact: true }));
  }
  await expect(page.getByRole("heading", { name: "Show your parent!", exact: true })).toBeFocused();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey);
  expect(saved.themes.general).toEqual(classicSave);
  expect(saved.themes[GROUPS_PROGRESS]).toBeUndefined();
  await activate(page.getByRole("button", { name: "Play again", exact: true }));
  await expect(page.locator("#level-count")).toHaveText("Level 1 of 7");
});

test("group quiz retains every workspace, withholds help and feedback, and grades final orders exactly", async ({ page }) => {
  test.slow();
  await openSample(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), progressKey);
  await page.goto("/alphabetical-order/?sort=groups&quiz=1");
  await expect(page.getByRole("link", { name: "Classic ABC quest", exact: true })).toHaveAttribute("href", /\?quiz=1$/);
  await expect(page.getByRole("link", { name: "Sort in smaller lists", exact: true })).toHaveAttribute("href", /sort=groups&quiz=1$/);
  await expect(page.locator("body")).not.toContainText("Worked example");
  await activate(page.getByRole("button", { name: "Start quiz", exact: true }));
  await createList(page, "My list", 3);
  const firstWords = await listed(page, "tray");
  await move(page, firstWords[0], "group-1");
  await expect(page.locator(".comparison-letter")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check order|Show hint/ })).toHaveCount(0);
  await activate(page.getByRole("button", { name: "Next question", exact: true }));
  await activate(page.getByRole("button", { name: "Previous question", exact: true }));
  expect(await listed(page, "group-1")).toEqual([firstWords[0]]);
  await expect(board(page, "group-1").getByLabel("Compare letter in My list", { exact: true })).toHaveValue("3");
  await activate(page.getByRole("button", { name: "Send My list to final ABC list", exact: true }));
  await activate(page.getByRole("button", { name: "Send Word tray to final ABC list", exact: true }));
  await sortList(page, "final");
  await audit(page);

  for (let question = 1; question < 7; question += 1) {
    await activate(page.getByRole("button", { name: "Next question", exact: true }));
    if (question < 6) {
      await activate(page.getByRole("button", { name: "Send Word tray to final ABC list", exact: true }));
      await sortList(page, "final");
    }
    await expect(page.locator("body")).not.toContainText(/Correct order:|right place|86%/);
  }
  await activate(page.getByRole("button", { name: "Review answers", exact: true }));
  await activate(page.getByRole("button", { name: "Edit question 1", exact: true }));
  expect(await listed(page, "final")).toEqual([...firstWords].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  await move(page, firstWords[0], "group-1");
  await move(page, firstWords[0], "final");
  await sortList(page, "final");
  await activate(page.getByRole("button", { name: "Review answers", exact: true }));
  await activate(page.getByRole("button", { name: "Submit quiz", exact: true }));
  await expect(page.locator(".quiz-score")).toHaveText("86% correct (6 of 7 questions)");
  await page.getByText("Answer details", { exact: true }).click();
  await expect(page.locator("#quest-complete details")).toContainText("Correct order:");
  await expect(page.locator("#quest-complete details")).toContainText("shared prefix");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe(before);
  expect(await page.evaluate((key) => localStorage.getItem(key), preferencesKey)).toBe(preferences);
  await audit(page);
});

test("group and classic modes switch through quiz settings without touching normal progress", async ({ page }) => {
  await page.goto("/alphabetical-order/?quiz=1");
  await page.getByLabel("Sorting mode", { exact: true }).selectOption("groups");
  await expect(page).toHaveURL(/quiz=1&sort=groups$/);
  await expect(page.getByLabel("Pick your theme", { exact: true })).toHaveCount(0);
  await page.getByLabel("Sorting mode", { exact: true }).selectOption("classic");
  await expect(page).toHaveURL(/\/\?quiz=1$/);
  await expect(page.getByLabel("Pick your theme", { exact: true })).toBeVisible();
});

test("workspaces reflow with enlarged OpenDyslexic text, dark mode and reduced motion in both modes", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const quiz of [false, true]) {
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/alphabetical-order/?sort=groups${quiz ? "&quiz=1" : ""}`);
      await activate(quiz ? page.getByRole("button", { name: "Start quiz", exact: true }) : page.locator("#start-game"));
      await createList(page, "Matching first letters", 2);
      const word = (await listed(page, "tray"))[0];
      await move(page, word, "group-1");
      await page.addStyleTag({ content: ":root { font-size:200%; } p, li, label, h2, h3 { letter-spacing:.12em; word-spacing:.16em; line-height:1.5; }" });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      for (const control of await page.locator(".group-workspace button:not(:disabled)").all()) {
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.width).toBeGreaterThanOrEqual(44);
      }
      await audit(page);
      if (!quiz) {
        // Explicitly start a fresh workspace on the next visit, not a resumed list with the same name.
        await activate(page.getByRole("button", { name: "Start this level over", exact: true }));
      }
    }
  }
});

test("unreadable saves and word-loading failures have visible recoverable errors", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem(key, '{"version":1,"themes":{"@letter-groups":{"level":99}}}'), progressKey);
  await page.goto("/alphabetical-order/?sort=groups");
  await expect(page.locator("#start-game")).toBeEnabled();
  await expect(page.locator(".warning")).toContainText("couldn't restore");
  await page.route("**/words.json", (route) => route.fulfill({ status: 503, body: "" }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Try loading words again", exact: true })).toBeVisible();
  await page.unroute("**/words.json");
  await activate(page.getByRole("button", { name: "Try loading words again", exact: true }));
  await expect(page.locator("#start-game")).toBeEnabled();
  await activate(page.locator("#start-game"));
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await createList(page, "c");
  await expect(page.locator(".warning")).toContainText("couldn't save");
  await expect(board(page, "group-1")).toBeVisible();
});

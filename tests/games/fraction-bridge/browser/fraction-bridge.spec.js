import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GAME_CELEBRATIONS } from "../../../../static/game-celebrations.js";

const BRIDGE_CELEBRATIONS = GAME_CELEBRATIONS["fraction-bridge"];

const progressKey = "kid-games.fraction-bridge.progress";
const start = async (page, level = 0) => {
  await page.goto("/fraction-bridge/");
  if (level) {
    await page.evaluate(({ key, level }) => localStorage.setItem(key, JSON.stringify({ version: 1, level })),
      { key: progressKey, level });
    await page.reload();
  }
  await page.locator("#start-game").click();
};
const audit = async (page) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
};

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cheered = (text) => new RegExp(`^(${BRIDGE_CELEBRATIONS.messages.map(escape).join("|")}) ${escape(text)}$`);
const bridgePoint = async (page, ratio) => {
  const plank = page.locator(".bridge-plank");
  await plank.scrollIntoViewIfNeeded();
  const box = await plank.boundingBox();
  return box.height > box.width
    ? { x: box.x + box.width / 2, y: box.y + box.height * (1 - ratio), vertical: true }
    : { x: box.x + box.width * ratio, y: box.y + box.height / 2, vertical: false };
};
const tapBridge = async (page, ratio) => {
  const { x, y } = await bridgePoint(page, ratio);
  await page.mouse.click(x, y);
};
const expectTillyAt = async (page, ratio) => {
  const point = await bridgePoint(page, ratio);
  await expect.poll(async () => {
    const box = await page.locator(".bridge-turtle").boundingBox();
    return Math.abs(point.vertical ? box.y + box.height / 2 - point.y : box.x + box.width / 2 - point.x);
  }).toBeLessThan(6);
  await expect.poll(async () => {
    const shade = await page.locator(".bridge-shade").boundingBox();
    const plank = await page.locator(".bridge-plank").boundingBox();
    const shaded = point.vertical ? shade.height / plank.height : shade.width / plank.width;
    return Math.abs(shaded - ratio);
  }).toBeLessThan(0.03);
};

test("the worked example explains intervals and tapping the bridge moves Tilly and checks the spot", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Fraction Bridge/ }).click();
  await expect(page).toHaveURL(/\/fraction-bridge\/$/);
  await expect(page.getByRole("heading", { name: "Worked example: find one half" })).toBeVisible();
  await expect(page.locator("#tutorial")).toContainText("denominator tells how many equal intervals");
  await expect(page.locator("#tutorial")).toContainText("There is no timer");
  await expect(page.locator("#tutorial")).toContainText("Tap or drag on the bridge");
  await page.locator("#start-game").press("Enter");
  await expect(page.locator("#level-title")).toBeFocused();
  await expect(page.locator(".bridge-label")).toHaveText(["0zero", "1/2one half", "1one"]);
  await expect(page.locator(".bridge-tick")).toHaveCount(3);
  await expect(page.locator("#challenge-area .fraction-position")).toHaveCount(0);
  await expect(page.locator(".bridge-target")).toHaveText("Walk Tilly to1/2one half");
  await expect(page.locator(".bridge-target-fraction")).toHaveCSS("font-weight", "800");
  await expect(page.locator("#challenge-area h3")).toHaveCount(0);
  for (const directions of await page.locator("#play-area").getByText(/arrow keys|No timer/).all()) {
    expect((await directions.boundingBox()).width).toBeLessThanOrEqual(1);
  }
  await expect(page.locator("#progress")).toHaveText("Level 1 of 8.");
  await expect(page.locator("#progress")).toHaveClass("visually-hidden");
  await expect(page.locator(".bridge-summary [aria-hidden]")).toHaveText("");
  const slider = page.getByRole("slider", { name: "Tilly's spot on the fraction bridge, from 0 to 1" });
  await expect(slider).toHaveAccessibleDescription(/Use the arrow keys to move Tilly, then press Enter or Space to check her spot\./);
  await expect(slider).toHaveAttribute("aria-valuetext", "No spot chosen yet; Tilly is at 0 (zero)");
  await tapBridge(page, 1);
  await expect(page.locator("#feedback")).toContainText("1 (one) is not the right spot yet");
  await expect(slider).toHaveAttribute("aria-valuetext", "1 (one)");
  await expectTillyAt(page, 1);
  await tapBridge(page, 0.4);
  await expect(page.locator("#feedback")).toHaveText(cheered("1/2 (one half) belongs here."));
  await expectTillyAt(page, 0.5);
  await expect(page.locator(".bridge-label.selected")).toHaveText("1/2one half");
  await expect(page.locator(".bridge-summary [aria-hidden]")).toHaveText("Shaded: 1/2 · Unshaded: 1/2");
  await expect(page.locator(".bridge-summary")).toContainText(
    "Tilly is at 1/2 (one half). Shaded part from 0: 1/2 (one half). Unshaded part: 1/2 (one half).");
  await expect(slider).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#next-level")).toBeFocused();
  await tapBridge(page, 1);
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await page.locator("#next-level").press("Enter");
  await expect(page.locator("#level-count")).toHaveText("Level 2 of 8");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey))
    .toEqual({ version: 1, level: 1 });
});

test("dragging snaps Tilly to the nearest tick and only checks when released", async ({ page }) => {
  await start(page, 3);
  await expect(page.locator("#level-title")).toHaveText("Eighths");
  await expect(page.locator(".bridge-label")).toHaveCount(9);
  const from = await bridgePoint(page, 0.1);
  const to = await bridgePoint(page, 0.6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await expect(page.locator(".bridge-summary")).toContainText("Tilly is at 1/8 (one eighth)");
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await expect(page.locator(".bridge-summary")).toContainText("Tilly is at 5/8 (five eighths)");
  await expect(page.locator(".bridge-summary")).toContainText("Unshaded part: 3/8 (three eighths)");
  await expect(page.locator("#feedback")).toHaveText("");
  await expectTillyAt(page, 5 / 8);
  await page.mouse.up();
  await expect(page.locator("#feedback")).toHaveText(cheered("5/8 (five eighths) belongs here."));
});

test("keyboard arrows move Tilly, Enter checks, and a button checks the current spot", async ({ page }) => {
  await start(page, 1);
  const slider = page.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "1/2 (one half)");
  await expectTillyAt(page, 0.5);
  await slider.press("Enter");
  await expect(page.locator("#feedback")).toContainText("1/2 (one half) is not the right spot yet");
  await expect(slider).toBeFocused();
  await slider.press("End");
  await slider.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuenow", "3");
  await expect(page.locator("#feedback")).toHaveText("");
  await page.getByRole("button", { name: "Check Tilly’s spot" }).click();
  await expect(page.locator("#feedback")).toHaveText(cheered("3/4 (three fourths) belongs here."));
  await expect(page.getByRole("button", { name: "Check Tilly’s spot" })).toBeDisabled();
  await expect(page.locator("#next-level")).toBeFocused();
});

test("touch taps move Tilly on the bridge", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "Touch input is covered by the touch-chromium project.");
  await start(page, 2);
  const point = await bridgePoint(page, 2 / 6);
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator("#feedback")).toHaveText(cheered("1/3 (one third) belongs here."));
  await expectTillyAt(page, 1 / 3);
});

test("equivalent fractions share one point and ordering uses keyboard controls", async ({ page }) => {
  await start(page, 4);
  await expect(page.locator("#level-title")).toHaveText("Share a stepping stone");
  await expect(page.locator(".bridge-target")).toHaveText("Walk Tilly to1/2 = 2/4one half = two fourths");
  await expect(page.locator(".bridge-label")).toHaveCount(9);
  await tapBridge(page, 0.5);
  await expect(page.locator("#feedback")).toHaveText(cheered("1/2 (one half) and 2/4 (two fourths) share this spot."));
  await page.locator("#next-level").click();
  await expect(page.locator("#level-title")).toHaveText("Order the stepping stones");
  await page.getByRole("button", { name: "Move 2/3 down" }).press("Enter");
  await page.getByRole("button", { name: "Check order" }).press("Enter");
  await expect(page.locator("#feedback")).toContainText("1/4 (one fourth), 2/3 (two thirds), 5/6 (five sixths) are in order");
  await page.locator("#next-level").click();
  await expect(page.locator("#level-title")).toHaveText("Which is greater?");
  await page.getByRole("button", { name: "3/8 (three eighths)" }).click();
  await expect(page.locator("#feedback")).toContainText("not greater yet");
  await page.getByRole("button", { name: "5/8 (five eighths)" }).click();
  await expect(page.locator("#feedback")).toContainText("5/8 (five eighths) is greater");
});

test("the optional hint restores hidden partitions and keeps storage failures visible", async ({ page }) => {
  await start(page, 7);
  await expect(page.locator(".bridge-tick")).toHaveCount(2);
  await expect(page.locator(".bridge-label")).toHaveText(["0zero", "1one"]);
  await tapBridge(page, 0.6);
  await expect(page.locator(".bridge-summary")).toContainText("Tilly is at 5/8 (five eighths)");
  await expect(page.locator(".bridge-label.selected")).toHaveCount(0);
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.locator(".bridge-tick")).toHaveCount(9);
  await expect(page.locator(".bridge-label")).toHaveCount(9);
  await expect(page.locator(".bridge-label.selected")).toHaveText("5/8five eighths");
  await expect(page.locator("#fraction-hint")).toContainText("denominator");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("blocked", "SecurityError"); },
  }));
  await page.reload();
  await page.locator("#start-game").click();
  await expect(page.locator("#preference-status")).toContainText("couldn't save");
  await expect(page.locator("#preference-status")).toBeVisible();
});

test("quiz bridge taps and keyboard revisions withhold feedback until exact results", async ({ page }) => {
  const savedProgress = '{"version":1,"level":3}';
  await page.goto(`/fraction-bridge/?quiz=1`);
  await page.evaluate((value) => localStorage.setItem("kid-games.fraction-bridge.progress", value), savedProgress);
  await page.reload();
  await expect(page.locator(".quiz-notice")).toContainText("change your answers as often as you like");
  await expect(page.locator("#tutorial")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "← All games" })).toHaveAttribute("href", /[?&]quiz=1/);
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByRole("heading", { name: "Find one half" })).toBeFocused();
  await expect(page.locator(".bridge-label")).toHaveCount(9);
  await expect(page.locator(".bridge-target")).toHaveText("Walk Tilly to1/2one half");
  await expect(page.getByRole("button", { name: /Check/ })).toHaveCount(0);
  await tapBridge(page, 0.25);
  await expect(page.locator(".bridge-summary")).toContainText(
    "Tilly is at 1/4 (one fourth). Shaded part from 0: 1/4 (one fourth). Unshaded part: 3/4 (three fourths).");
  await expectTillyAt(page, 0.25);
  await expect(page.locator(".fraction-bridge")).not.toContainText(/right spot|belongs|Correct|Incorrect/);
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator(".bridge-line.celebrating")).toHaveCount(0);
  const slider = page.getByRole("slider");
  await slider.press("ArrowRight");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "1/2 (one half)");
  await expect(page.locator(".fraction-bridge")).toContainText("Answer selected. You can change it before submitting.");
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "No spot chosen yet; Tilly is at 0 (zero)");
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "4");
  await expectTillyAt(page, 0.5);
  await page.getByRole("button", { name: "Next question" }).click();
  await tapBridge(page, 0.5);
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.locator(".bridge-label")).toHaveCount(7);
  await tapBridge(page, 0.5);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "2/4 (two fourths)" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "5/8 (five eighths)" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Move 1/4 up" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await expect(page.locator(".quiz-review")).toContainText("Find one half: 1/2 (one half)");
  await expect(page.locator(".quiz-review")).toContainText("Find one third: 1/2 (one half)");
  await page.getByRole("button", { name: "Submit quiz" }).click();
  await expect(page.locator(".quiz-score")).toHaveText("83% correct (5 of 6 questions)");
  await page.getByText("Answer details").click();
  await expect(page.locator("#quest-complete")).toContainText("Your answer: 1/2 (one half). 1/3 (one third) belongs at 1/3.");
  expect(await page.evaluate((key) => localStorage.getItem(key), progressKey)).toBe(savedProgress);
});

for (const colorScheme of ["light", "dark"]) {
  test(`fraction bridge passes accessibility checks in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/fraction-bridge/");
    await audit(page);
    await start(page);
    await tapBridge(page, 1);
    await page.getByRole("button", { name: "Show hint" }).click();
    await audit(page);
    await page.goto("/fraction-bridge/?quiz=1");
    await page.getByRole("button", { name: "Start quiz" }).click();
    await tapBridge(page, 0.75);
    await audit(page);
  });
}

test("the bridge reflows to a vertical line at phone width with OpenDyslexic and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page, 3);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass("opendyslexic");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByRole("slider")).toHaveAttribute("aria-orientation", "vertical");
  const overlaps = await page.locator(".bridge-label").evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect());
    return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).map(() => i));
  });
  expect(overlaps).toEqual([]);
  const track = await page.locator(".bridge-track").boundingBox();
  expect(track.width).toBeGreaterThanOrEqual(44);
  expect(track.height / 9).toBeGreaterThanOrEqual(44);
  const slider = page.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowUp");
  await expect(slider).toHaveAttribute("aria-valuetext", "1/8 (one eighth)");
  await tapBridge(page, 5 / 8);
  await expect(page.locator("#feedback")).toHaveText(cheered("5/8 (five eighths) belongs here."));
  await expectTillyAt(page, 5 / 8);
  expect(await page.locator(".bridge-turtle").evaluate((turtle) => getComputedStyle(turtle).transitionDuration)).toBe("0s");
});

test("wide screens keep a horizontal bridge with non-overlapping fraction labels", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.addInitScript(() => localStorage.setItem("kid-games.font", "opendyslexic"));
  await start(page, 3);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("slider")).toHaveAttribute("aria-orientation", "horizontal");
  const overlaps = await page.locator(".bridge-label").evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect());
    return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).map(() => i));
  });
  expect(overlaps).toEqual([]);
});

// matrix(a, b, ...): a < 0 faces right (mirrored), a > 0 faces left; b > 0 faces up, b < 0 faces down.
const turtleFacing = (page) => page.locator(".bridge-turtle").evaluate((turtle) => {
  const [a, b] = getComputedStyle(turtle).transform.match(/-?[\d.e]+/g).map(Number);
  if (Math.abs(a) > 0.5) return a < 0 ? "right" : "left";
  return b > 0 ? "up" : "down";
});

for (const [width, forward, back] of [[1024, "right", "left"], [320, "up", "down"]]) {
  test(`Tilly faces the way she walks on a ${width}px bridge`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await start(page, 7);
    const slider = page.getByRole("slider");
    await slider.focus();
    expect(await turtleFacing(page)).toBe(forward);
    await slider.press("ArrowRight");
    await slider.press("ArrowRight");
    expect(await turtleFacing(page)).toBe(forward);
    await slider.press("ArrowLeft");
    expect(await turtleFacing(page)).toBe(back);
    await tapBridge(page, 1);
    expect(await turtleFacing(page)).toBe(forward);
    await tapBridge(page, 0);
    expect(await turtleFacing(page)).toBe(back);
  });
}

const effects = new Map(BRIDGE_CELEBRATIONS.effects.map((effect) => [effect.id, effect]));

test("right answers set off a themed celebration, Tilly hops, and wrong answers do not", async ({ page }) => {
  await start(page, 3);
  await tapBridge(page, 0.25);
  await expect(page.locator("#feedback")).toHaveText("1/4 (one fourth) is not the right spot yet. Try again.");
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator(".bridge-line.celebrating")).toHaveCount(0);
  await tapBridge(page, 5 / 8);
  await expect(page.locator("#feedback")).toHaveText(cheered("5/8 (five eighths) belongs here."));
  await expect(page.locator("#feedback")).toHaveClass(/success/);
  const layer = page.locator(".celebration");
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  const { effect, motion, pieces } = await layer.evaluate((element) => ({ ...element.dataset, pieces: element.children.length }));
  expect(effects.get(effect)?.motion).toBe(motion);
  expect(pieces).toBe(effects.get(effect).count);
  await expect(page.locator(".bridge-line")).toHaveClass(/celebrating/);
  expect(await page.locator(".bridge-turtle").evaluate((turtle) => getComputedStyle(turtle).animationName)).toBe("tilly-hop");
  expect(await page.locator(".bridge-label.selected").evaluate((label) => getComputedStyle(label, "::after").content)).toBe('"✨"');
  await page.locator("#next-level").click();
  await expect(page.locator(".celebration")).toHaveCount(0);
  await expect(page.locator(".bridge-line.celebrating")).toHaveCount(0);
  await expect(page.locator("#feedback")).not.toHaveClass(/success/);
});

test("ordering, comparing, and finishing the bridge celebrate too", async ({ page }) => {
  await start(page, 5);
  await page.getByRole("button", { name: "Move 2/3 down" }).click();
  await page.getByRole("button", { name: "Check order" }).click();
  await expect(page.locator("#feedback")).toHaveText(cheered("1/4 (one fourth), 2/3 (two thirds), 5/6 (five sixths) are in order."));
  await expect(page.locator(".celebration")).toHaveCount(1);
  await page.locator("#next-level").click();
  await page.getByRole("button", { name: "5/8 (five eighths)" }).click();
  await expect(page.locator("#feedback")).toHaveText(cheered("5/8 (five eighths) is greater because it is farther from 0."));
  await expect(page.locator(".celebration")).toHaveCount(1);
  await page.locator("#next-level").click();
  await tapBridge(page, 0.75);
  await page.locator("#next-level").click();
  await expect(page.locator("#quest-heading")).toBeFocused();
  await expect(page.locator(".celebration")).toHaveCount(1);
});

test("with reduced motion the rewards stay still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page, 0);
  await tapBridge(page, 0.5);
  await expect(page.locator(".celebration")).toHaveCount(1);
  expect(await page.locator(".celebration").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator(".celebration .still")).toHaveCount(5);
  for (const selector of [".bridge-turtle", ".bridge-shade"]) {
    expect(await page.locator(selector).evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  }
  expect(await page.locator(".bridge-label.selected").evaluate((label) => getComputedStyle(label, "::after").animationName)).toBe("none");
  await audit(page);
});

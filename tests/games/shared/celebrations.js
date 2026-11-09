import { expect } from "@playwright/test";

export async function expectThemedCelebration(page, celebrations) {
  const layer = page.locator(".celebration");
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  const effectId = await layer.getAttribute("data-effect");
  const effect = celebrations.effects.find(({ id }) => id === effectId);
  expect(effect, `${effectId} belongs to this game's themed rewards`).toBeTruthy();
  await expect(layer).toHaveAttribute("data-motion", effect.motion);
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(await layer.evaluate((element) => element.children.length)).toBe(reduced ? 5 : effect.count);
  return effect;
}

export function cheerPattern(celebrations, text = "") {
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(${celebrations.messages.map(escape).join("|")}) ${escape(text)}`);
}

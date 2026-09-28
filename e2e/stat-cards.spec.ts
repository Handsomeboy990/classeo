import type { Page } from "@playwright/test";

import type { Role } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// Key figures with the largest text size on a laptop screen (rapport
// final, D-B1; WCAG 1.4.4): a figure never wraps, since "19 523" split over
// two lines reads as two other numbers, and no word of a card label or a
// shortcut title is cut in the middle.

// The words split over two lines, and the figures drawn on more than one
// line, among the key figure cards and the shortcut tiles of the page.
async function cutWordsAndFigures(page: Page) {
  return page.evaluate(() => {
    function lineCount(node: Node, start: number, end: number) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const tops: number[] = [];
      for (const r of range.getClientRects()) {
        if (r.width === 0) continue;
        if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
      }
      return tops.length;
    }
    const cutWords: string[] = [];
    const labels = document.querySelectorAll("[data-stat-label], nav[aria-labelledby=shortcuts-title] li p:first-child");
    for (const el of labels) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        for (const m of (n.textContent ?? "").matchAll(/\S+/g)) {
          if (lineCount(n, m.index, m.index + m[0].length) > 1) cutWords.push(m[0]);
        }
      }
    }
    const wrappedFigures: string[] = [];
    for (const el of document.querySelectorAll("[data-stat-figure]")) {
      const text = el.firstChild;
      if (text && lineCount(text, 0, text.textContent?.length ?? 0) > 1) wrappedFigures.push(el.textContent ?? "");
    }
    return { labels: labels.length, figures: document.querySelectorAll("[data-stat-figure]").length, cutWords, wrappedFigures };
  });
}

test.describe("key figures with the largest text size", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  const DASHBOARDS: { role: Role; path: string }[] = [
    { role: "ministre", path: "/espace" },
    { role: "ministre", path: "/espace/statistiques" },
    { role: "ddemp", path: "/espace" },
    { role: "directeur", path: "/espace" },
    { role: "comptable", path: "/espace/frais" },
    { role: "enseignant", path: "/espace" },
  ];

  for (const { role, path } of DASHBOARDS) {
    test(`${role} ${path} at 1366 px in xxl: whole figures, whole words`, async ({ pageAs }) => {
      const page = await pageAs(role);
      await page.addInitScript(() => localStorage.setItem("classeo:text", "xxl"));
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-text", "xxl");
      await expect(page.locator("[data-stat-figure]").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const found = await cutWordsAndFigures(page);
      expect(found.labels, "labels measured").toBeGreaterThan(3);
      expect(found.figures, "figures measured").toBeGreaterThan(3);
      expect(found.wrappedFigures, "figures on more than one line").toEqual([]);
      expect(found.cutWords, "words cut over two lines").toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "sideways scroll in pixels").toBeLessThanOrEqual(0);
    });
  }
});

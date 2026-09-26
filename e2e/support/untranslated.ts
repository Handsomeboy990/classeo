import type { Page } from "@playwright/test";

// What a reader sees or hears on a page, collected the same way whatever the
// interface language: visible text, the attributes read aloud or shown in a
// tooltip (placeholder, aria-label, title, alt, button values), the options
// of a select, SVG labels, the hidden text an aria-describedby points to.
// The whole document is walked, not only the main region: the top bar, the
// menus, the tab bar and the dialogs opened in the top layer count too.
// Used by the translation journeys: a string shown in French and still shown
// identical once the interface is in a local language was not translated.

export type Seen = { text: string; kind: string; region: string };

export async function visibleTexts(page: Page): Promise<Seen[]> {
  return page.evaluate(() => {
    const out: { text: string; kind: string; region: string }[] = [];
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    // Left out: what the application marks as never translated by the
    // interface layer, the language switcher (the names of the languages,
    // in their own language) and texts translated on request.
    const skip = "script, style, noscript, template, [data-no-translate], [translate=no]";
    const visible = (el: Element) => el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
    const region = (el: Element) =>
      el.closest("#page-content")
        ? "page"
        : el.closest("dialog, [popover], [role=dialog]")
          ? "overlay"
          : el.closest("[data-tab-bar]")
            ? "tab-bar"
            : el.closest("aside")
              ? "sidebar"
              : el.closest("header")
                ? "header"
                : "other";
    const push = (el: Element, text: string | null | undefined, kind: string) => {
      const t = norm(text ?? "");
      if (t) out.push({ text: t, kind, region: region(el) });
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(skip) || el.closest("textarea, option, select")) continue;
      if (!visible(el)) continue;
      push(el, n.textContent, el.closest("svg") ? "svg" : "text");
    }

    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest(skip) || !visible(el)) continue;
      for (const attr of ["placeholder", "aria-label", "title", "alt", "aria-description", "aria-valuetext", "aria-roledescription"]) {
        if (el.hasAttribute(attr)) push(el, el.getAttribute(attr), attr);
      }
      if (el instanceof HTMLInputElement && ["button", "submit", "reset"].includes(el.type)) push(el, el.value, "value");
      if (el instanceof HTMLSelectElement) {
        for (const o of el.options) push(el, o.text, "option");
        for (const g of el.querySelectorAll("optgroup")) push(el, g.label, "optgroup");
      }
      // Heard but not shown: a hidden hint an element points to.
      for (const id of (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)) {
        const target = document.getElementById(id);
        if (target && !visible(target)) push(el, target.textContent, "described-by");
      }
    }
    return out;
  });
}

// A string worth checking: it has a word of two letters or more, and is not
// a bare code, grade, amount or date in figures.
export function hasWords(text: string) {
  return /\p{L}{2,}/u.test(text) && !/^[\p{Lu}\d\s.,:/-]{1,6}$/u.test(text);
}

// The strings of `translated` already present, identical, in `french`:
// left in French. `allow` keeps what is never translated (names of people,
// schools and places, amounts, codes).
export function leftInFrench(french: Seen[], translated: Seen[], allow: (text: string) => boolean = () => false) {
  const source = new Set(french.map((s) => s.text));
  const seen = new Set<string>();
  const out: Seen[] = [];
  for (const s of translated) {
    const key = `${s.kind}|${s.text}`;
    if (seen.has(key) || !source.has(s.text) || !hasWords(s.text) || allow(s.text)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

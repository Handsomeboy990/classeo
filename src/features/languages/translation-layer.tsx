"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { initLanguages, setTranslationStatus, useLanguageState } from "./client";
import { translateDated } from "./date-words";
import { applyUnit, ATTRIBUTES, changedRoots, collect, keysOf, prune, restoreAll, sourceOf, type Unit } from "./dom";
import { bcp47, inLanguage, type TargetLanguage } from "./languages";
import { isQueueable, lookupText, namePattern } from "./text";

type Status = "idle" | "loading" | "done" | "partial" | "unavailable";

// Translations already received in this tab, per language: going back to a
// page costs no request. `asked` holds the strings already sent for this
// page, so a string the cache lacks is not asked again at every change.
const memory = new Map<TargetLanguage, Map<string, string>>();
const asked = new Map<TargetLanguage, Set<string>>();
const MAX_TEXTS = 800; // per request, as the route accepts
const FOLLOW_UP_DELAY = 300;
const LATER_DELAY = 250;
const MAX_LATER_TRIES = 40;

async function fetchTranslations(lang: TargetLanguage, texts: string[]) {
  const map = memory.get(lang) ?? new Map<string, string>();
  memory.set(lang, map);
  let pending = 0;
  for (let i = 0; i < texts.length; i += MAX_TEXTS) {
    const res = await fetch("/api/langues/interface", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, texts: texts.slice(i, i + MAX_TEXTS) }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { translations: Record<string, string>; pending: number };
    for (const [k, v] of Object.entries(body.translations)) map.set(k, v);
    pending += body.pending;
  }
  return { map, pending };
}

// Interface translation for the users holding translation:view. Mounted
// once by the private space layout; translates the whole document (the shell, the page, the
// dialogs, sheets and toasts rendered in portals) and follows its changes:
// client side navigation, a refreshed list, a dialog opening. French stays
// the default; the choice is remembered on this device for this account.
export function TranslationLayer({ userId, languages, voices, names }: { userId: string; languages: string[]; voices: string[]; names: string[] }) {
  const s = useLanguageState();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const refresh = useRef<(() => void) | null>(null);

  // Keyed by value: a refreshed layout sends new arrays with the same
  // content, which must not reset the choice.
  const languagesKey = languages.join(",");
  const voicesKey = voices.join(",");
  // Names are kept and looked up as template values (see numberTemplate).
  const namesKey = names.join("\n");
  const pattern = useMemo(() => namePattern(namesKey.split("\n")), [namesKey]);
  useEffect(() => {
    initLanguages({ allowed: true, userId, languages: languagesKey.split(",").filter(Boolean), voices: voicesKey.split(",").filter(Boolean) });
  }, [userId, languagesKey, voicesKey]);

  const active = s.allowed && s.lang !== "fr" && !s.showOriginal ? (s.lang as TargetLanguage) : null;

  useEffect(() => {
    const main = document.getElementById("page-content");
    // Back to French first: a string missing in the new language must not
    // stay in the previous one.
    restoreAll();
    main?.removeAttribute("lang");
    if (!active) {
      refresh.current = null;
      return;
    }
    const lang = active;
    let cancelled = false;
    let map = memory.get(lang) ?? new Map<string, string>();
    const sent = asked.get(lang) ?? new Set<string>();
    asked.set(lang, sent);
    const waiting = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const plain = (text: string) => lookupText(text, map, undefined, pattern);
    const lookup = (text: string) => lookupText(text, map, (t) => translateDated(t, lang, plain), pattern);

    // Regions React has not hydrated yet (a streamed section) are taken again
    // a moment later: hydration changes nothing in the document, so no
    // mutation would bring them back.
    const later = new Set<Element>();
    let laterTimer: ReturnType<typeof setTimeout> | undefined;
    let laterTries = 0;
    const gather = (root: Node) => collect(root, { onLater: (el) => later.add(el) });
    // A steady pace, never pushed back by the changes of the page: a region
    // that React never owns (an element another script added) only costs
    // a few passes.
    const retryLater = () => {
      if (!later.size || laterTries >= MAX_LATER_TRIES || laterTimer !== undefined) return;
      laterTimer = setTimeout(() => {
        laterTimer = undefined;
        laterTries++;
        const roots = [...later].filter((el) => el.isConnected);
        later.clear();
        apply(roots.flatMap(gather));
        if (waiting.size) followUp();
        retryLater();
      }, LATER_DELAY);
    };
    // One request for the strings gathered within the delay; a burst of
    // changes does not keep pushing it back.
    const followUp = () => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        void ask(false);
      }, FOLLOW_UP_DELAY);
    };

    // Known strings at once; the others wait for the next request. Returns
    // the number of interface strings left in French (names and figures,
    // never translated, are not counted).
    const apply = (units: Unit[]) => {
      let gaps = 0;
      for (const u of units) {
        if (applyUnit(u, lookup)) continue;
        if (isQueueable(sourceOf(u))) gaps++;
        for (const k of keysOf(u, pattern)) if (!sent.has(k) && !map.has(k)) waiting.add(k);
      }
      return gaps;
    };

    const ask = async (first: boolean) => {
      const texts = [...waiting];
      waiting.clear();
      texts.forEach((t) => sent.add(t));
      if (first) setStatus("loading");
      try {
        const result = texts.length ? await fetchTranslations(lang, texts) : { map, pending: 0 };
        if (cancelled) return;
        map = result.map;
        const gaps = apply(gather(document.body));
        retryLater();
        main?.setAttribute("lang", bcp47(lang));
        setStatus(gaps > 0 || result.pending > 0 ? "partial" : "done");
      } catch {
        // Asked again by the next pass (a change, a new page).
        texts.forEach((t) => sent.delete(t));
        if (!cancelled) setStatus("unavailable");
      }
    };

    // First pass: whatever is known already, then one request for the rest.
    const scan = () => {
      laterTries = 0;
      apply(gather(document.body));
      void ask(true);
    };
    scan();
    // A new page: the strings still missing are asked once more, the
    // background queue may have translated them since.
    refresh.current = () => {
      for (const k of [...sent]) if (!map.has(k)) sent.delete(k);
      scan();
    };

    // Later updates (a tab, a refreshed thread, a dialog, a toast, a new
    // page): known strings at once, unknown ones in one grouped request.
    const observer = new MutationObserver((records) => {
      const roots = changedRoots(records);
      if (!roots.length) return;
      prune();
      apply(roots.flatMap(gather));
      if (waiting.size) followUp();
      retryLater();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(laterTimer);
      observer.disconnect();
      refresh.current = null;
    };
  }, [active, pattern]);

  // Client side navigation: the observer already translated the new page
  // from the cache; this asks for what it still lacks.
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    refresh.current?.();
  }, [pathname]);

  const message = !active
    ? s.lang !== "fr"
      ? "Texte original en français."
      : ""
    : {
        idle: "",
        loading: `Traduction ${inLanguage(s.lang)}…`,
        done: `Page traduite ${inLanguage(s.lang)}.`,
        partial: `Page traduite ${inLanguage(s.lang)} en partie : le reste s'affiche en français.`,
        unavailable: "Traduction indisponible pour le moment : la page reste en français.",
      }[status];

  useEffect(() => {
    setTranslationStatus(message);
  }, [message]);

  // The switcher itself lives in the top bar (language-menu.tsx); this only
  // announces where the translation stands, from outside any hidden bar.
  return (
    <p data-no-translate data-read-skip role="status" className="sr-only">
      {message}
    </p>
  );
}

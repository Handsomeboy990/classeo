"use client";

import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { initLanguages, setLanguage, setShowOriginal, useLanguageState } from "./client";
import { forget, prune, restoreAll, sourceKey, textNodes, translateNode, wasWrittenByLayer } from "./dom";
import { bcp47, inLanguage, LANGUAGES, languageLabel, type LanguageCode, type TargetLanguage } from "./languages";

type Status = "idle" | "loading" | "done" | "partial" | "unavailable";

// Translations already received in this tab, per language: going back to a
// page costs no request.
const memory = new Map<TargetLanguage, Map<string, string>>();
const MAX_FOLLOW_UPS = 4;

async function fetchTranslations(lang: TargetLanguage, texts: string[]) {
  const map = memory.get(lang) ?? new Map<string, string>();
  memory.set(lang, map);
  const res = await fetch("/api/langues/interface", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang, texts: texts.slice(0, 800) }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as { translations: Record<string, string>; pending: number };
  for (const [k, v] of Object.entries(body.translations)) map.set(k, v);
  return { map, pending: body.pending };
}

// Language switcher and interface translation for the users holding
// translation:view. Mounted once by the private space layout, above the
// main region. French stays the default; the choice is remembered on this
// device for this account.
export function TranslationLayer({ userId, languages, voices }: { userId: string; languages: string[]; voices: string[] }) {
  const s = useLanguageState();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const selectId = useId();
  const followUps = useRef(0);

  // Keyed by value: a refreshed layout sends new arrays with the same
  // content, which must not reset the choice.
  const languagesKey = languages.join(",");
  const voicesKey = voices.join(",");
  useEffect(() => {
    initLanguages({ allowed: true, userId, languages: languagesKey.split(",").filter(Boolean), voices: voicesKey.split(",").filter(Boolean) });
  }, [userId, languagesKey, voicesKey]);

  const active = s.allowed && s.lang !== "fr" && !s.showOriginal ? (s.lang as TargetLanguage) : null;

  useEffect(() => {
    const main = document.getElementById("page-content");
    if (!main) return;
    // Back to French first: a string missing in the new language must not
    // stay in the previous one.
    restoreAll();
    main.removeAttribute("lang");
    if (!active) return;
    let cancelled = false;
    followUps.current = 0;
    let map = memory.get(active) ?? new Map<string, string>();
    let waiting = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = (nodes: Text[]) => {
      let missing = 0;
      for (const n of nodes) {
        if (!translateNode(n, map)) {
          missing++;
          waiting.add(sourceKey(n));
        }
      }
      return missing;
    };

    const ask = async (texts: string[], first: boolean) => {
      if (first) setStatus("loading");
      try {
        const result = await fetchTranslations(active, texts);
        if (cancelled) return;
        map = result.map;
        waiting = new Set();
        const missing = apply(textNodes(main));
        main.setAttribute("lang", bcp47(active));
        setStatus(missing > 0 || result.pending > 0 ? "partial" : "done");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    // First pass: whatever is known already, then one request for the page.
    const nodes = textNodes(main);
    apply(nodes);
    void ask([...new Set(nodes.map(sourceKey))], true);

    // Later updates (a tab, a refreshed thread, a streamed section): known
    // strings at once, unknown ones in a grouped follow up request.
    const observer = new MutationObserver((records) => {
      const changed: Text[] = [];
      for (const r of records) {
        if (r.type === "characterData" && r.target.nodeType === Node.TEXT_NODE) {
          const t = r.target as Text;
          if (wasWrittenByLayer(t)) continue;
          forget(t);
          changed.push(...textNodes(t));
        }
        r.addedNodes.forEach((n) => changed.push(...textNodes(n)));
      }
      if (!changed.length) return;
      prune();
      apply(changed);
      if (waiting.size && followUps.current < MAX_FOLLOW_UPS) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          followUps.current++;
          void ask([...waiting], false);
        }, 800);
      }
    });
    observer.observe(main, { subtree: true, childList: true, characterData: true });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [active, pathname]);

  const label = languageLabel(s.lang);
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

  if (!s.allowed) return null;
  return (
    <div data-no-translate data-read-skip className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 print:hidden max-lg:[body:has([data-chat])_&]:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border bg-surface px-3 py-2">
        <label htmlFor={selectId} className="flex items-center gap-2 text-sm font-semibold">
          <Languages className="size-5 text-primary" aria-hidden />
          Langue
        </label>
        <select
          id={selectId}
          value={s.lang}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="min-h-11 rounded-control border border-field-border bg-surface px-3 text-base font-medium sm:min-h-10"
        >
          {LANGUAGES.filter((l) => l.code === "fr" || languages.includes(l.code)).map((l) => (
            <option key={l.code} value={l.code} lang={l.bcp47}>
              {l.label}
            </option>
          ))}
        </select>
        {s.lang !== "fr" && (
          <button
            type="button"
            aria-pressed={s.showOriginal}
            onClick={() => setShowOriginal(!s.showOriginal)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-control border px-3 text-sm font-semibold sm:min-h-10",
              s.showOriginal ? "border-primary bg-primary-soft text-primary" : "border-border-strong bg-surface hover:bg-surface-2",
            )}
          >
            {s.showOriginal ? `Revenir au ${label.toLowerCase()}` : "Voir en français"}
          </button>
        )}
        <p role="status" className="min-w-0 flex-1 basis-48 text-sm text-muted">
          {message}
        </p>
      </div>
    </div>
  );
}

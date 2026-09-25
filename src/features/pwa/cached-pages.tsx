"use client";

import { FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { readOfflineState } from "@/features/offline/client";

const LABELS: [RegExp, string][] = [
  [/^\/espace$/, "Tableau de bord"],
  [/^\/espace\/aide$/, "Guide d'utilisation"],
  [/^\/espace\/suivi$/, "Mes enfants"],
  [/^\/espace\/suivi\/[^/]+\/notes$/, "Notes du trimestre"],
  [/^\/espace\/suivi\/[^/]+\/presences$/, "Présences"],
  [/^\/espace\/suivi\/[^/]+\/emploi-du-temps$/, "Emploi du temps"],
  [/^\/espace\/suivi\/[^/]+\/frais$/, "Frais de scolarité"],
  [/^\/espace\/suivi\/[^/]+$/, "Bulletins"],
];

function label(path: string) {
  const pathname = path.split("?")[0]!;
  return LABELS.find(([re]) => re.test(pathname))?.[1] ?? pathname;
}

// Lists the pages this device kept for offline reading, for the account the
// service worker keeps them for (see public/sw.js).
export function CachedPages() {
  const [pages, setPages] = useState<string[] | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!("caches" in window)) return setPages([]);
      // Only the cache of the account the worker keeps pages for.
      const state = await readOfflineState();
      const names = state ? (await caches.keys()).filter((n) => n.startsWith("classeo-user-") && n.endsWith(`-${state.userId}`)) : [];
      const urls = new Set<string>();
      for (const n of names) for (const req of await (await caches.open(n)).keys()) urls.add(new URL(req.url).pathname + new URL(req.url).search);
      if (!alive) return;
      setTitles(new Map((state?.pages ?? []).filter((p) => p.title).map((p) => [p.url, p.title!])));
      setPages([...urls].sort());
    })().catch(() => alive && setPages([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {pages === null ? null : pages.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pages.map((p) => (
            <li key={p}>
              <a href={p} className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface px-4 font-semibold hover:border-primary">
                <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                {titles.get(p) ?? label(p)}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Aucune page n&apos;est encore enregistrée sur cet appareil. Connectez-vous une fois avec du réseau : vos pages principales seront gardées sur cet appareil.</p>
      )}
      <Button type="button" onClick={() => window.location.reload()} className="self-start">
        <RefreshCw aria-hidden />
        Réessayer
      </Button>
    </div>
  );
}

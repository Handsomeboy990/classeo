"use client";

import { Accessibility, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { AccessibilityPanel } from "./accessibility-panel";
import { Sheet } from "./sheet";
import { isActiveHref, type RenderedSection } from "./sidebar-nav";

// Accents and case do not matter when searching: "eleves" finds "Élèves".
function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// Every section the user may open, grouped as in the sidebar, with a search
// field. Full height sheet opened from the "Menu" tab.
export function MenuSheet({ sections, open, onClose }: { sections: RenderedSection[]; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [a11y, setA11y] = useState(false);
  const q = normalize(query);
  // The display settings, also reachable here: the floating button is hidden
  // on pages with a save bar at the bottom.
  const showSettings = !q || normalize("Réglages Accessibilité taille du texte contraste thème voix").includes(q);
  const shown = q
    ? sections
        .map((s) => ({ ...s, items: s.items.filter((i) => normalize(`${i.label} ${i.short ?? ""} ${s.title}`).includes(q)) }))
        .filter((s) => s.items.length > 0)
    : sections;

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <>
    <Sheet
      open={open}
      onClose={close}
      title="Menu"
      full
      header={
        <div className="px-4 pb-3">
          <label className="relative block">
            <span className="sr-only">Rechercher une rubrique</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une rubrique"
              enterKeyHint="search"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-border-strong bg-surface-2 pr-3 pl-10 text-base text-text placeholder:text-muted focus-visible:bg-surface"
            />
          </label>
        </div>
      }
    >
      <nav aria-label="Menu principal" className="flex flex-col gap-5 pt-1">
        {shown.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-1 text-xs font-semibold tracking-wider text-muted uppercase">{section.title}</p>
            <ul className="overflow-hidden rounded-card border border-border bg-surface">
              {section.items.map((item) => {
                const active = isActiveHref(pathname, item.href);
                return (
                  <li key={item.href} className="border-b border-border last:border-b-0">
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-13 items-center gap-3 px-3 py-2 font-medium active:bg-surface-2",
                        active ? "bg-primary-soft text-primary" : "text-text",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
                          active ? "bg-surface text-primary" : "bg-surface-2 text-primary",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">{item.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {showSettings && (
          <div>
            <p className="mb-1.5 px-1 text-xs font-semibold tracking-wider text-muted uppercase">Réglages</p>
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  close();
                  setA11y(true);
                }}
                className="flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left font-medium text-text active:bg-surface-2"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary [&_svg]:size-5">
                  <Accessibility aria-hidden />
                </span>
                <span className="min-w-0 flex-1">Accessibilité</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {!shown.length && !showSettings && (
          <p className="px-1 py-6 text-center text-muted" role="status">
            Aucune rubrique ne correspond à « {query.trim()} ».
          </p>
        )}
      </nav>
    </Sheet>
    <AccessibilityPanel open={a11y} onClose={() => setA11y(false)} />
    </>
  );
}

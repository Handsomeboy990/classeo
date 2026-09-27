"use client";

import { Accessibility, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { BrandSettings } from "@/components/brand/settings";
import { cn } from "@/lib/utils";

import { AccessibilityPanel } from "./accessibility-panel";
import { FOOTER_LINKS, SpaceNotice } from "./app-footer";
import { Sheet } from "./sheet";
import { badgeId, isActiveHref, NavBadge, type RenderedSection } from "./sidebar-nav";

// Accents and case do not matter when searching: "eleves" finds "Élèves".
function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

const TITLE = "mb-2 px-1 font-display text-[0.6875rem] leading-[1.3] font-bold tracking-[0.08em] text-muted uppercase";
const ROW = "relative flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left font-display text-[0.9375rem] leading-snug";
const ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-control [&_svg]:size-5";

// Every section the user may open, grouped as in the sidebar, with a search
// field. Full height sheet opened from the "Menu" tab: the light version of
// the side menu (design source of truth, part 3.4), the current entry on the
// soft navy with a navy bar on its left edge. At the end, the help, check and
// credits links and the independence notice, which stay reachable on the
// full screen pages that set the app footer aside.
export function MenuSheet({ sections, brand, open, onClose }: { sections: RenderedSection[]; brand: BrandSettings; open: boolean; onClose: () => void }) {
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
                className="ds-field pl-10"
              />
            </label>
          </div>
        }
      >
        <nav aria-label="Menu principal" className="flex flex-col gap-6 pt-1">
          {shown.map((section) => (
            <div key={section.title}>
              <p className={TITLE}>{section.title}</p>
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {section.items.map((item) => {
                  const active = isActiveHref(pathname, item.href);
                  return (
                    <li key={item.href} className="border-b border-border last:border-b-0">
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        aria-describedby={item.badge ? badgeId("sheet", item.href) : undefined}
                        className={cn(
                          ROW,
                          active
                            ? "bg-primary-soft font-semibold text-primary before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-primary"
                            : "font-medium text-text hover:bg-surface-2 active:bg-surface-2",
                        )}
                      >
                        <span className={cn(ICON, active ? "bg-surface text-primary" : "bg-primary-soft text-primary")}>{item.icon}</span>
                        <span className="min-w-0 flex-1">{item.label}</span>
                        <NavBadge count={item.badge} id={badgeId("sheet", item.href)} />
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
              <p className={TITLE}>Réglages</p>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    close();
                    setA11y(true);
                  }}
                  className={cn(ROW, "font-medium text-text hover:bg-surface-2 active:bg-surface-2")}
                >
                  <span className={cn(ICON, "bg-primary-soft text-primary")}>
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
        <div className="mt-6 border-t border-border pt-4 pb-2">
          {!q && (
            <ul className="-mx-2 mb-3 flex flex-wrap items-center text-sm">
              {FOOTER_LINKS.map((l, i) => (
                <li key={l.href} className="flex items-center">
                  {i > 0 && (
                    <span aria-hidden className="text-border-strong">
                      ·
                    </span>
                  )}
                  <Link href={l.href} prefetch={false} onClick={close} className="inline-flex min-h-11 items-center rounded-control px-2 font-semibold text-link underline-offset-[3px] hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <SpaceNotice brand={brand} className="px-1" />
        </div>
      </Sheet>
      <AccessibilityPanel open={a11y} onClose={() => setA11y(false)} />
    </>
  );
}

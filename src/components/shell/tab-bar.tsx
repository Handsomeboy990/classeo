"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { badgeText, unreadLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { MenuSheet } from "./menu-sheet";
import { isActiveHref, type RenderedItem, type RenderedSection } from "./sidebar-nav";
import { prefersReducedMotion } from "./use-compact";

function Tab({ active, icon, label, badge, dot }: { active: boolean; icon: ReactNode; label: string; badge?: number; dot?: boolean }) {
  return (
    <>
      <span
        data-active={active || undefined}
        className={cn(
          "tab-pill relative inline-flex h-8 w-full max-w-14 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-150 group-active:scale-90 [&_svg]:size-[1.35rem] [&_svg]:shrink-0",
          active ? "bg-primary-soft text-primary [&_svg]:stroke-[2.4]" : "text-muted",
        )}
      >
        {icon}
        {/* Unread notifications of this destination; on "Menu", a dot when
            an entry inside has some. */}
        {!!badge && (
          <span className="nav-badge absolute -top-1 left-1/2 ml-1" aria-hidden>
            {badgeText(badge)}
          </span>
        )}
        {dot && !badge && <span className="nav-dot absolute top-0 left-1/2 ml-2.5" aria-hidden />}
      </span>
      <span className={cn("max-w-full truncate text-[0.6875rem] leading-tight font-medium tracking-[-0.01em]", active ? "text-primary" : "text-muted")}>{label}</span>
      {!!badge && <span className="sr-only">, {unreadLabel(badge)}</span>}
      {dot && !badge && <span className="sr-only">, nouvelles notifications</span>}
    </>
  );
}

// Each tab shares the width equally and may shrink (very large text on a
// narrow phone): the pill narrows, the icon keeps its size, the label is
// truncated rather than pushing the last tab off screen.
const TAB = "group flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 select-none";

// Phone tab bar: the four destinations the user needs most (chosen from
// their own menu, see mobileTabs in lib/navigation.ts) and "Menu" for the
// rest. Fixed above the home indicator. Touching the current tab again
// scrolls back to the top, as in native apps.
export function TabBar({ tabs, sections }: { tabs: RenderedItem[]; sections: RenderedSection[] }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const current = tabs.find((t) => isActiveHref(pathname, t.href));
  // An entry of the Menu sheet (not a tab, not Notifications, which the bell
  // already counts) has unread items.
  const menuHasNews = sections.some((s) => s.items.some((i) => i.badge && i.href !== "/espace/notifications" && !tabs.some((t) => t.href === i.href)));

  return (
    <>
      <nav
        data-tab-bar
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_12px_rgb(0_0_0/0.05)] lg:hidden"
      >
        <ul className="mx-auto flex h-(--tab-bar-h) max-w-xl">
          {tabs.map((tab) => {
            const active = tab === current;
            return (
              <li key={tab.href} className="min-w-0 flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={TAB}
                  onClick={(e) => {
                    if (pathname !== tab.href) return;
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
                  }}
                >
                  <Tab active={active} icon={tab.icon} label={tab.short ?? tab.label} badge={tab.badge} />
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button type="button" className={TAB} onClick={() => setMenu(true)} aria-haspopup="dialog" aria-expanded={menu}>
              <Tab active={!current || menu} icon={<LayoutGrid aria-hidden />} label="Menu" dot={menuHasNews} />
            </button>
          </li>
        </ul>
      </nav>
      <MenuSheet sections={sections} open={menu} onClose={() => setMenu(false)} />
    </>
  );
}

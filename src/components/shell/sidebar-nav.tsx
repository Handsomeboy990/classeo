"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { badgeText, unreadLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type RenderedItem = { label: string; short?: string; href: string; icon: ReactNode; badge?: number };
export type RenderedSection = { title: string; items: RenderedItem[] };

// Active entry: the dashboard only on its own path, any other entry on its
// path and every page below it, unless another entry of the menu matches
// more closely (/espace/statistiques/connexions is not /espace/statistiques).
export function isActiveHref(pathname: string, href: string, others: readonly string[] = []) {
  const matches = (h: string) => (h === "/espace" ? pathname === "/espace" : pathname === h || pathname.startsWith(`${h}/`));
  return matches(href) && !others.some((o) => o.length > href.length && o.startsWith(`${href}/`) && matches(o));
}

export function menuHrefs(sections: readonly RenderedSection[]) {
  return sections.flatMap((s) => s.items.map((i) => i.href));
}

// Unread notifications of an entry: a count the eye finds, and the same
// count in words, given to the link as its description (aria-describedby),
// so the name of the entry stays "Messagerie" and screen readers add
// "2 non lues".
export function NavBadge({ count, id, className }: { count?: number; id: string; className?: string }) {
  if (!count) return null;
  return (
    <>
      <span className={cn("nav-badge", className)} aria-hidden>
        {badgeText(count)}
      </span>
      <span id={id} hidden>
        {unreadLabel(count)}
      </span>
    </>
  );
}

// Id of the description of an entry's badge, unique per menu.
export function badgeId(menu: string, href: string) {
  return `${menu}-badge-${href.replace(/[^\w-]/g, "-")}`;
}

// The navy side menu (design source of truth, part 3.4): section titles in
// small spaced capitals, entries of 44 px. The current entry reads white on
// a light veil, its icon turns flag yellow and a yellow bar marks its left
// edge, so it never depends on colour alone. Focus rings are yellow on navy
// (globals.css, .bg-sidebar).
export function SidebarNav({ sections, onNavigate }: { sections: RenderedSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const hrefs = menuHrefs(sections);
  const isActive = (href: string) => isActiveHref(pathname, href, hrefs);

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 font-display text-[0.6875rem] leading-[1.3] font-bold tracking-[0.08em] text-sidebar-muted uppercase">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-describedby={item.badge ? badgeId("side", item.href) : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-control px-3 py-1.5 font-display text-sm leading-snug transition-[background-color,color] duration-150 [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
                      active
                        ? "bg-white/10 font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-r-control before:bg-flag-yellow [&_svg]:text-flag-yellow"
                        : "font-medium text-sidebar-text hover:bg-sidebar-hover [&_svg]:text-sidebar-muted",
                    )}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <NavBadge count={item.badge} id={badgeId("side", item.href)} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

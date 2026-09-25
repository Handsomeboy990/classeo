"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { badgeText, unreadLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type RenderedItem = { label: string; short?: string; href: string; icon: ReactNode; badge?: number };
export type RenderedSection = { title: string; items: RenderedItem[] };

// Active entry: the dashboard only on its own path, any other entry on its
// path and every page below it.
export function isActiveHref(pathname: string, href: string) {
  return href === "/espace" ? pathname === "/espace" : pathname === href || pathname.startsWith(`${href}/`);
}

// Unread notifications of an entry: a count the eye finds, and the same
// count in words for screen readers.
export function NavBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <>
      <span className={cn("nav-badge", className)} aria-hidden>
        {badgeText(count)}
      </span>
      <span className="sr-only">, {unreadLabel(count)}</span>
    </>
  );
}

export function SidebarNav({ sections, onNavigate }: { sections: RenderedSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => isActiveHref(pathname, href);

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-sidebar-muted uppercase">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-text [&_svg]:size-5 [&_svg]:shrink-0",
                      active ? "bg-accent text-on-accent" : "hover:bg-sidebar-hover",
                    )}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <NavBadge count={item.badge} />
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

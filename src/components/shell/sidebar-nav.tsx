"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type RenderedSection = { title: string; items: { label: string; href: string; icon: ReactNode }[] };

export function SidebarNav({ sections, onNavigate }: { sections: RenderedSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/espace" ? pathname === "/espace" : pathname === href || pathname.startsWith(`${href}/`));

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
                    {item.label}
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

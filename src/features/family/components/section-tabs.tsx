"use client";

import { CalendarCheck, CalendarDays, FileText, NotebookPen, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ICONS = { bulletins: FileText, notes: NotebookPen, presences: CalendarCheck, "emploi-du-temps": CalendarDays, frais: Wallet };

export type SectionKey = keyof typeof ICONS;

// Sections of a student file as links: they work without JavaScript, can be
// bookmarked, and each one is cached for offline reading once visited.
export function SectionTabs({ base, sections }: { base: string; sections: { key: SectionKey; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections du suivi" data-print-hide>
      <ul className="flex flex-wrap gap-2">
        {sections.map(({ key, label }) => {
          const href = key === "bulletins" ? base : `${base}/${key}`;
          const active = pathname === href;
          const Icon = ICONS[key];
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                  active ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-text hover:bg-surface-2",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

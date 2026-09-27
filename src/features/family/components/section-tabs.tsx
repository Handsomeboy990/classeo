"use client";

import { CalendarCheck, CalendarDays, FileText, History, NotebookPen, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = { bulletins: FileText, notes: NotebookPen, presences: CalendarCheck, "emploi-du-temps": CalendarDays, frais: Wallet, parcours: History };

export type SectionKey = keyof typeof ICONS;

// Sections of a student file as links: they work without JavaScript, can be
// bookmarked, and each one is cached for offline reading once visited. On a
// phone they scroll sideways on one line (the layout keeps the scroll
// position from one section to the next).
export function SectionTabs({ base, sections }: { base: string; sections: { key: SectionKey; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections du suivi" className="ds-tabs -mx-5 px-3 sm:mx-0 sm:px-0" data-print-hide>
      {sections.map(({ key, label }) => {
        const href = key === "bulletins" ? base : `${base}/${key}`;
        const active = pathname === href;
        const Icon = ICONS[key];
        return (
          <Link key={key} href={href} aria-current={active ? "page" : undefined} className="px-3 sm:px-4">
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

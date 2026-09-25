import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/kit/states";
import { PrintButton, PrintStyles } from "@/features/fees/components/print";
import { WeekGrid } from "@/features/timetable/components/week-grid";
import { loadTimetable } from "@/features/timetable/load";
import { requirePermission } from "@/lib/auth/authorize";
import { addDays } from "@/lib/domain/timetable";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Emploi du temps, version imprimable" };

// Paper version: the full week grid on one landscape A4 page, without the
// application shell and without edit controls.
export default async function PrintTimetablePage({ searchParams }: PageProps<"/espace/emploi-du-temps/imprimer">) {
  const user = await requirePermission("timetable:view");
  const sp = await searchParams;
  const t = await loadTimetable(user, sp);
  const back = new URLSearchParams({ ...(t.selected ? { classe: t.selected.id } : {}), semaine: t.monday.toISOString().slice(0, 10) });
  const who = t.mode === "teacher" ? user.fullName : (t.selected?.name ?? "");

  return (
    <>
      <PrintStyles landscape />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/espace/emploi-du-temps?${back}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Retour à l&apos;emploi du temps
        </Link>
        <PrintButton label="Imprimer l'emploi du temps" />
      </div>
      <header className="mb-4">
        <p className="text-sm text-muted">{user.scope.label}</p>
        <h1 className="text-2xl font-bold">
          Emploi du temps · {who}
        </h1>
        <p className="text-sm text-muted">
          Semaine du {formatDate(t.monday)} au {formatDate(addDays(t.monday, 5))}
          {t.yearLabel ? ` · année ${t.yearLabel}` : ""}
        </p>
      </header>
      {t.slots.length === 0 ? (
        <EmptyState title="Aucun cours planifié" />
      ) : (
        <WeekGrid slots={t.slots} monday={t.monday} todayIso="" showClass={t.mode === "teacher"} rights={{ update: false, delete: false }} assignments={[]} />
      )}
    </>
  );
}

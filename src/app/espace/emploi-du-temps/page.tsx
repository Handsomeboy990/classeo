import { CalendarDays, ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterSelect } from "@/features/fees/components/filter-select";
import { FormDialog } from "@/features/fees/components/form-dialog";
import { DayList } from "@/features/timetable/components/day-list";
import { SlotForm } from "@/features/timetable/components/slot-form";
import { WeekGrid } from "@/features/timetable/components/week-grid";
import { loadTimetable } from "@/features/timetable/load";
import { requirePermission } from "@/lib/auth/authorize";
import { addDays } from "@/lib/domain/timetable";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Emploi du temps" };

export default async function TimetablePage({ searchParams }: PageProps<"/espace/emploi-du-temps">) {
  const user = await requirePermission("timetable:view");
  const sp = await searchParams;
  const t = await loadTimetable(user, sp);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const values = { classe: t.selected?.id, semaine: iso(t.monday), ...patch };
    for (const [k, v] of Object.entries(values)) if (v) next.set(k, v);
    return `/espace/emploi-du-temps?${next}`;
  };
  const printHref = `/espace/emploi-du-temps/imprimer?${new URLSearchParams({ ...(t.selected ? { classe: t.selected.id } : {}), semaine: iso(t.monday) })}`;

  if (t.mode === "unavailable")
    return (
      <>
        <PageHeader title="Emploi du temps" />
        <Card>
          <EmptyState icon={<CalendarDays className="size-7" />} title="Emploi du temps par établissement" description="L'emploi du temps se consulte depuis un compte rattaché à un établissement." />
        </Card>
      </>
    );

  const title = t.mode === "teacher" ? "Mon emploi du temps" : "Emploi du temps";
  const description =
    t.mode === "teacher"
      ? `Vos cours de la semaine, dans toutes vos classes${t.yearLabel ? ` · année ${t.yearLabel}` : ""}.`
      : t.selected
        ? `Classe de ${t.selected.name}${t.yearLabel ? ` · année ${t.yearLabel}` : ""}.`
        : "Aucune classe disponible.";
  const showClass = t.mode === "teacher";
  const slotRights = { update: t.rights.update, delete: t.rights.delete };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <ButtonLink href={printHref} variant="secondary">
              <Printer aria-hidden /> Version imprimable
            </ButtonLink>
            {(t.mode === "teacher" || t.selected) && (
              <PdfDownloadLink
                href={`/api/pdf/emploi-du-temps?${new URLSearchParams({ ...(t.selected ? { classe: t.selected.id } : {}), semaine: iso(t.monday) })}`}
                description={t.mode === "teacher" ? "mon emploi du temps de la semaine" : `emploi du temps de la ${t.selected?.name}`}
              />
            )}
            {t.rights.create && t.selected && (
              <FormDialog
                trigger={
                  <>
                    <Plus aria-hidden /> Ajouter un cours
                  </>
                }
                title={`Ajouter un cours · ${t.selected.name}`}
                description="Le cours se répète chaque semaine. La classe et l'enseignant doivent être libres."
              >
                <SlotForm assignments={t.assignments} defaults={{ room: `Salle ${t.selected.name}` }} />
              </FormDialog>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {t.mode === "class" && t.classes.length > 0 ? (
          <FilterSelect param="classe" label="Classe affichée" options={t.classes.map((c) => ({ value: c.id, label: c.name }))} />
        ) : (
          <span />
        )}
        <nav aria-label="Semaine affichée" className="flex items-center gap-2">
          <Link href={href({ semaine: iso(addDays(t.monday, -7)) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong bg-surface hover:bg-surface-2" aria-label="Semaine précédente">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <p className="min-w-44 text-center text-sm font-semibold" aria-live="polite">
            Semaine du {formatDate(t.monday)}
          </p>
          <Link href={href({ semaine: iso(addDays(t.monday, 7)) })} className="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong bg-surface hover:bg-surface-2" aria-label="Semaine suivante">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
          <Link href={href({ semaine: undefined })} className="text-sm font-semibold text-primary hover:underline">
            Cette semaine
          </Link>
        </nav>
      </div>

      {t.slots.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-7" />}
            title="Aucun cours planifié"
            description={t.rights.create && t.selected ? "Ajoutez le premier cours de cette classe avec le bouton « Ajouter un cours »." : "L'emploi du temps n'a pas encore été saisi."}
          />
        </Card>
      ) : (
        <>
          <WeekGrid slots={t.slots} monday={t.monday} todayIso={t.todayIso} showClass={showClass} rights={slotRights} assignments={t.assignments} className="max-md:hidden" />
          <DayList
            slots={t.slots}
            monday={t.monday}
            day={t.day}
            dayHref={(d) => href({ jour: String(d) })}
            showClass={showClass}
            rights={slotRights}
            assignments={t.assignments}
            className="md:hidden"
          />
        </>
      )}
    </>
  );
}

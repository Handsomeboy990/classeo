import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/kit/states";
import { PrintButton } from "@/components/kit/print-button";
import { requirePermission } from "@/lib/auth/authorize";
import { loadTimetablePdf } from "@/lib/pdf/data/timetable";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { calendarDate, documentReference } from "@/lib/pdf/format";
import { PrintSheet } from "@/lib/pdf/print/sheet";
import { PrintWeekGrid } from "@/lib/pdf/print/week-grid";

export const metadata: Metadata = { title: "Emploi du temps, version imprimable" };

// Paper version: the week grid on one landscape A4 page, laid out like the
// PDF, without the application shell and without edit controls. The same
// scoped loader as the PDF: a class the user may not open shows nothing.
export default async function PrintTimetablePage({ searchParams }: PageProps<"/espace/emploi-du-temps/imprimer">) {
  const user = await requirePermission("timetable:view");
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["classe", "semaine"]) {
    const v = sp[key];
    const value = Array.isArray(v) ? v[0] : v;
    if (value) query.set(key, value);
  }
  const t = await loadTimetablePdf(user, query);
  const back = `/espace/emploi-du-temps${query.size ? `?${query}` : ""}`;

  if (!t) {
    return (
      <EmptyState
        title="Emploi du temps indisponible"
        description="Cet emploi du temps n'est pas dans votre périmètre."
        action={
          <Link href={back} className="font-semibold text-primary hover:underline">
            Retour à l&apos;emploi du temps
          </Link>
        }
      />
    );
  }

  const { data } = t;
  const now = new Date();
  const week = data.monday.toISOString().slice(0, 10);
  const meta = {
    title: "Emploi du temps",
    subtitle: `${data.who}${data.yearLabel ? ` · ${data.yearLabel}` : ""}`,
    reference: documentReference("EDT", now, t.subjectId, week),
    generatedAt: now,
    generatedBy: { name: user.fullName, role: user.role.name, email: user.email },
    issuer: t.issuer,
  };
  const pdfQuery = new URLSearchParams(query);
  pdfQuery.set("semaine", week);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href={back} className="inline-flex items-center gap-1.5 max-lg:hidden text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Retour à l&apos;emploi du temps
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Imprimer l'emploi du temps" />
          <PdfDownloadLink href={`/api/pdf/emploi-du-temps?${pdfQuery}`} description={`emploi du temps, ${data.who}`} />
        </div>
      </div>
      <PrintSheet
        meta={meta}
        landscape
        headerExtra={
          <p className="doc-muted mt-2 text-xs">
            Semaine du {calendarDate(data.monday)} au {calendarDate(data.saturday)}
            {data.kind === "teacher" ? " · toutes les classes de l'enseignant" : ""}
          </p>
        }
      >
        <PrintWeekGrid slots={data.slots} />
      </PrintSheet>
    </>
  );
}

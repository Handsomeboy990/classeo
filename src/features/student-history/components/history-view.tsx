import { ArrowRight, CalendarCheck, EyeOff, FileText, GraduationCap, School } from "lucide-react";
import Link from "next/link";

import { AverageLevel } from "@/components/kit/level";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ENROLLMENT_STATUS_LABELS } from "@/features/students/labels";
import { TransferStatusBadge } from "@/features/transfers/components/transfer-timeline";
import { KIND_LABELS } from "@/features/transfers/logic";
import { formatRank } from "@/lib/domain/report-card";
import { formatDate, formatPercent, plural } from "@/lib/utils";

import type { StudentHistory } from "../queries";

// The school path of a pupil, newest year first: each stay (a school and a
// class, cut by the transfers of the year), its published report cards and
// its attendance, then the transfers.
export function HistoryView({ history, reportCardHref, transferHref }: { history: StudentHistory; reportCardHref: (c: { id: string; enrollmentId: string; periodId: string }, schoolId: string) => string | null; transferHref: (id: string) => string }) {
  const { years, transfers, full } = history;
  const hiddenStays = years.reduce((n, y) => n + y.hidden, 0);
  return (
    <div className="flex flex-col gap-6">
      {!full && hiddenStays > 0 && (
        <p className="flex items-start gap-2 rounded-control border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {plural(hiddenStays, "passage")} dans d&apos;autres établissements ne sont pas affichés : le dossier scolaire n&apos;a pas été partagé avec vous.
          </span>
        </p>
      )}

      <section aria-labelledby="years-title">
        <h2 id="years-title" className="mb-3 flex items-center gap-2 text-xl font-bold">
          <GraduationCap className="size-5 text-primary" aria-hidden /> Années scolaires
        </h2>
        {years.every((y) => y.segments.length === 0) ? (
          <EmptyState className="rounded-card border border-border bg-surface" title="Aucune année à afficher" />
        ) : (
          <ol className="flex flex-col gap-4">
            {years
              .filter((y) => y.segments.length > 0)
              .map((y) => (
                <li key={y.yearId} className="rounded-card border border-border bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                    <h3 className="text-lg font-bold">Année {y.label}</h3>
                    {y.isActive && <Badge tone="info">Année en cours</Badge>}
                  </div>
                  <ol className="divide-y divide-border">
                    {y.segments.map((s) => (
                      <li key={s.key} className="flex flex-col gap-3 px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-3">
                            <School className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                            <div className="min-w-0">
                              <p className="font-semibold">
                                {s.classroom}
                                {s.level ? <span className="font-normal text-muted"> ({s.level})</span> : null}
                              </p>
                              <p className="text-sm text-muted">
                                {s.school}
                                {s.place ? `, ${s.place}` : ""}
                                {s.to ? ` · jusqu'au ${formatDate(s.to)}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="flex flex-wrap gap-1">
                            {s.isRepeating && <Badge>Redoublant</Badge>}
                            <Badge tone={s.status === "ACTIVE" ? "success" : "warning"}>{s.to ? "Parti en cours d'année" : ENROLLMENT_STATUS_LABELS[s.status]}</Badge>
                          </span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                          <div>
                            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
                              <FileText className="size-4" aria-hidden /> Bulletins
                            </p>
                            {s.reportCards.length ? (
                              <ul className="flex flex-col gap-2">
                                {s.reportCards.map((c) => {
                                  const href = reportCardHref(c, s.schoolId);
                                  return (
                                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-2 px-3 py-2 text-sm">
                                      <span>
                                        <span className="font-semibold">{c.period}</span>
                                        <span className="text-muted">
                                          {" "}
                                          · rang {formatRank(c.rank)} sur {c.classSize}
                                        </span>
                                      </span>
                                      <span className="flex items-center gap-2 [&_.rounded-full]:flex-wrap">
                                        <AverageLevel average={c.average} />
                                        {href && (
                                          <Link href={href} className="font-semibold text-primary hover:underline" aria-label={`Voir le bulletin du ${c.period} ${y.label}`}>
                                            Voir
                                          </Link>
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted">Aucun bulletin publié pour ce passage.</p>
                            )}
                          </div>
                          <div>
                            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
                              <CalendarCheck className="size-4" aria-hidden /> Présence
                            </p>
                            {s.attendance.recorded ? (
                              <p className="text-sm">
                                <span className="font-display text-2xl font-bold">{formatPercent(s.attendance.rate)}</span>
                                <span className="block text-muted">
                                  {plural(s.attendance.absences, "absence")}, {plural(s.attendance.lates, "retard")} (demi-journées)
                                </span>
                              </p>
                            ) : (
                              <p className="text-sm text-muted">Aucun appel enregistré.</p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="transfers-title">
        <h2 id="transfers-title" className="mb-3 flex items-center gap-2 text-xl font-bold">
          <ArrowRight className="size-5 text-primary" aria-hidden /> Transferts
        </h2>
        {transfers.length ? (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {transfers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={transferHref(t.id)} className="font-semibold text-primary hover:underline">
                    {KIND_LABELS[t.kind]}
                  </Link>
                  <p className="text-muted">
                    {t.kind === "CLASS_CHANGE" ? `${t.fromClassroom ?? "?"} vers ${t.toClassroom ?? "?"}, ${t.fromSchool}` : `${t.fromSchool} vers ${t.toSchool}${t.toClassroom ? `, ${t.toClassroom}` : ""}`} ·{" "}
                    {formatDate(t.decidedAt ?? t.createdAt)}
                  </p>
                </div>
                <TransferStatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="rounded-card border border-border bg-surface" title="Aucun transfert" description="Les changements de classe et d'établissement s'afficheront ici." />
        )}
      </section>
    </div>
  );
}

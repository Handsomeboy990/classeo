import { ArrowLeft, CalendarCheck, CheckCircle2, Clock, Coins, FileText, ReceiptText, XCircle } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { AverageLevel } from "@/components/kit/level";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, de, formatAverage, formatDate, formatFcfa, formatPercent } from "@/lib/utils";

import { ATTENDANCE_STATUS, DAYS, INVOICE_STATUS, rankLabel, spokenTime, timetableGrid, type AttendanceRecord, type SchoolDay } from "../logic";
import type { ReportCardView, SlotView, termGrades, invoicesOf } from "../queries";

import { StudentAvatar } from "@/features/students/components/student-avatar";

import { Pictogram } from "./blocks";

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

export function ReportCardSheet({ card, student }: { card: ReportCardView; student: { name: string; matricule: string; photoFileId?: string | null } }) {
  const totalCoef = card.lines.reduce((n, l) => n + l.coefficient, 0);
  const totalPoints = card.lines.reduce((n, l) => n + (l.average ?? 0) * l.coefficient, 0);
  return (
    <article aria-labelledby="report-title" className="rounded-card border border-border bg-surface [&_.rounded-full]:flex-wrap" data-print-root>
      <div className="hidden items-center gap-3 border-b border-border px-5 py-3 print:flex">
        <LogoMark className="size-10" />
        <div className="text-sm leading-tight">
          <p className="font-bold">République du Bénin · Classéo</p>
          <p>{card.school}</p>
        </div>
      </div>
      <header className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <StudentAvatar name={student.name} photoFileId={student.photoFileId} className="size-14 text-lg" />
          <div className="min-w-0">
            <h2 id="report-title" className="text-xl font-bold sm:text-2xl">
              Bulletin du {card.periodName.toLowerCase()} · {card.yearLabel}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {student.name} · Matricule {student.matricule} · {card.classroom} · {card.school}
            </p>
            <p className="text-sm text-muted">Publié le {formatDate(card.publishedAt)}</p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <div className="rounded-lg bg-surface-2 px-4 py-2">
            <dt className="text-xs font-semibold text-muted uppercase">Moyenne générale</dt>
            <dd className="mt-1">
              <AverageLevel average={card.average} />
            </dd>
          </div>
          <div className="rounded-lg bg-surface-2 px-4 py-2">
            <dt className="text-xs font-semibold text-muted uppercase">Rang</dt>
            <dd className="mt-1 font-display text-xl font-bold">{rankLabel(card.rank, card.classSize)}</dd>
          </div>
        </dl>
      </header>

      <Table>
        <caption className="sr-only">
          Moyennes par matière, {card.periodName} {card.yearLabel}
        </caption>
        <THead>
          <tr>
            <TH>Matière</TH>
            <TH className="text-center max-sm:hidden">Coef.</TH>
            <TH>Moyenne sur 20</TH>
            <TH className="text-right max-md:hidden">Points</TH>
            <TH className="text-right max-sm:hidden">Rang</TH>
          </tr>
        </THead>
        <tbody>
          {card.lines.map((l) => (
            <TR key={l.subject}>
              <TD className="font-semibold">
                {l.subject}
                <span className="block text-xs font-normal text-muted sm:hidden">
                  Coefficient {l.coefficient} · Rang {rankLabel(l.rank)}
                </span>
              </TD>
              <TD className="text-center tabular-nums max-sm:hidden">{l.coefficient}</TD>
              <TD>
                <AverageLevel average={l.average} />
              </TD>
              <TD className="text-right tabular-nums max-md:hidden">{l.average === null ? "–" : formatAverage(l.average * l.coefficient)}</TD>
              <TD className="text-right tabular-nums max-sm:hidden">{rankLabel(l.rank)}</TD>
            </TR>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border-strong bg-surface-2 font-bold">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-center tabular-nums max-sm:hidden">{totalCoef}</td>
            <td className="px-4 py-3">
              <AverageLevel average={card.average} />
            </td>
            <td className="px-4 py-3 text-right tabular-nums max-md:hidden">{formatAverage(totalPoints)}</td>
            <td className="px-4 py-3 text-right tabular-nums max-sm:hidden">{rankLabel(card.rank, card.classSize)}</td>
          </tr>
        </tfoot>
      </Table>

      <footer className="border-t border-border p-5">
        <p className="text-xs font-semibold text-muted uppercase">Appréciation du conseil de classe</p>
        <p className="mt-1 text-lg">{card.appreciation ?? "Aucune appréciation."}</p>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Grades of the running term
// ---------------------------------------------------------------------------

const KIND = { INTERROGATION: "Interrogation", DEVOIR: "Devoir", COMPOSITION: "Composition" } as const;

export function TermGradesList({ term }: { term: Awaited<ReturnType<typeof termGrades>> }) {
  return (
    <div className="flex flex-col gap-3 [&_.rounded-full]:flex-wrap">
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {term.subjects.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-sans text-base font-bold">{s.subject}</h3>
                <p className="text-sm text-muted">
                  Coefficient {s.coefficient}
                  {s.teacher ? ` · ${s.teacher}` : ""}
                </p>
              </div>
              <AverageLevel average={s.average} />
            </div>
            <ul className="flex flex-wrap gap-2 text-sm" aria-label={`Notes ${de(s.subject)}`}>
              {s.grades.length ? (
                s.grades.map((g) => (
                  <li key={`${g.type}-${g.sequence}`} className="rounded-lg border border-border bg-surface-2 px-2.5 py-1">
                    {KIND[g.type]}
                    {g.type === "INTERROGATION" ? ` ${g.sequence}` : ""} : <strong className="tabular-nums">{formatAverage(g.value).replace(",00", "")}</strong>/{g.maxValue}
                  </li>
                ))
              ) : (
                <li className="text-muted">Pas encore de note.</li>
              )}
              {s.compositionAverage === null && s.grades.length > 0 && <li className="rounded-lg border border-dashed border-border-strong px-2.5 py-1 text-muted">Composition à venir</li>}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Calcul de la moyenne d&apos;une matière : (moyenne des interrogations + devoir + 2 × composition) ÷ 4. Une note pas encore saisie ne compte pas.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: AttendanceRecord["status"] }) {
  const s = ATTENDANCE_STATUS[status];
  const Icon = status === "PRESENT" ? CheckCircle2 : status === "ABSENT" ? XCircle : Clock;
  return (
    <Badge tone={s.tone}>
      <Icon aria-hidden />
      {s.label}
    </Badge>
  );
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function AttendanceHistory({ records }: { records: (AttendanceRecord & { id: string })[] }) {
  const byDay = new Map<string, (AttendanceRecord & { id: string })[]>();
  for (const r of records) {
    const k = r.date.toISOString().slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface">
      {[...byDay.entries()].map(([day, list]) => {
        const flagged = list.some((r) => r.status !== "PRESENT");
        const label = dayFmt.format(new Date(`${day}T00:00:00Z`));
        return (
          <li key={day} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4", flagged && "bg-danger-soft/40")}>
            <p className="font-semibold sm:w-56 sm:shrink-0">{label.charAt(0).toUpperCase() + label.slice(1)}</p>
            <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
              {(["MORNING", "AFTERNOON"] as const).map((half) => {
                const r = list.find((x) => x.half === half);
                if (!r) return null;
                return (
                  <p key={half} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 text-muted">{half === "MORNING" ? "Matin" : "Après-midi"}</span>
                    <StatusBadge status={r.status} />
                    {r.reason && <span className="text-muted">Motif : {r.reason}</span>}
                    {r.status === "ABSENT" && !r.reason && <span className="text-muted">Motif non renseigné</span>}
                  </p>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AttendanceFigures({ absences, lates, excused, rate }: { absences: number; lates: number; excused: number; rate: number | null }) {
  const items = [
    { label: "Demi-journées d'absence", value: String(absences), icon: XCircle, tone: absences ? ("danger" as const) : ("success" as const) },
    { label: "Retards", value: String(lates), icon: Clock, tone: lates ? ("warning" as const) : ("success" as const) },
    { label: "Absences excusées", value: String(excused), icon: CalendarCheck, tone: "info" as const },
    { label: "Taux de présence", value: formatPercent(rate), icon: CheckCircle2, tone: "primary" as const },
  ];
  return (
    <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
          <Pictogram icon={i.icon} tone={i.tone} />
          <div>
            <dt className="text-sm text-muted">{i.label}</dt>
            <dd className="font-display text-2xl font-bold">{i.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

export function TimetableWeek({ slots, today }: { slots: SlotView[]; today: SchoolDay }) {
  const { bands, days, cell } = timetableGrid(slots);
  return (
    <>
      {/* Phones and large text: one block per day, today marked. */}
      <ol className="flex flex-col gap-3 xl:hidden">
        {days.map((d) => {
          const list = slots.filter((s) => s.dayOfWeek === d);
          const isToday = d === today.dayOfWeek;
          return (
            <li key={d} className={cn("rounded-card border bg-surface", isToday ? "border-2 border-primary" : "border-border")} aria-current={isToday ? "date" : undefined}>
              <h3 className={cn("flex items-center justify-between gap-2 rounded-t-card px-4 py-2 font-sans text-base font-bold", isToday ? "bg-primary text-on-primary" : "bg-surface-2")}>
                {DAYS[d - 1]}
                {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent">Aujourd&apos;hui</span>}
              </h3>
              {list.length ? (
                <ul className="divide-y divide-border">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-col gap-0.5 px-4 py-2.5 min-[420px]:flex-row min-[420px]:gap-3">
                      <span className="shrink-0 text-sm font-semibold text-primary tabular-nums min-[420px]:w-24">
                        {spokenTime(s.startTime)} à {spokenTime(s.endTime)}
                      </span>
                      <span className="min-w-0 break-words hyphens-auto">
                        <span className="block font-semibold">{s.subject}</span>
                        <span className="block text-sm text-muted">{[s.room, s.teacher].filter(Boolean).join(" · ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-muted">Pas de cours.</p>
              )}
            </li>
          );
        })}
      </ol>

      {/* Wide screens: the weekly grid. */}
      <div className="max-xl:hidden">
        <Table>
          <caption className="sr-only">Emploi du temps de la semaine, aujourd&apos;hui : {DAYS[today.dayOfWeek - 1]}</caption>
          <THead>
            <tr>
              <TH className="w-24">Horaire</TH>
              {days.map((d) => (
                <TH key={d} className={cn(d === today.dayOfWeek && "bg-primary text-on-primary")} aria-current={d === today.dayOfWeek ? "date" : undefined}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {DAYS[d - 1]}
                    {d === today.dayOfWeek && <span className="rounded-full bg-accent px-2 py-0.5 text-xs tracking-normal text-on-accent normal-case">Aujourd&apos;hui</span>}
                  </span>
                </TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.start} className="border-t border-border">
                <th scope="row" className="px-4 py-3 text-left align-top text-sm font-semibold whitespace-nowrap text-muted tabular-nums">
                  <span className="block text-text">{spokenTime(b.start)}</span>
                  <span className="block">à {spokenTime(b.end)}</span>
                </th>
                {days.map((d) => {
                  const s = cell(d, b.start, b.end);
                  return (
                    <td key={d} className={cn("px-2 py-2 align-top", d === today.dayOfWeek && "bg-primary-soft")}>
                      {s ? (
                        <div className="rounded-lg border border-border bg-surface px-2.5 py-2">
                          <p className="text-sm font-bold">{s.subject}</p>
                          <p className="text-xs text-muted">{[s.room, s.teacher].filter(Boolean).join(" · ")}</p>
                        </div>
                      ) : (
                        <span className="sr-only">Pas de cours</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

const METHOD = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", BANK_TRANSFER: "Virement", CHEQUE: "Chèque" } as const;

export function InvoiceCard({ invoice }: { invoice: Awaited<ReturnType<typeof invoicesOf>>[number] }) {
  const status = INVOICE_STATUS[invoice.status] ?? INVOICE_STATUS.PENDING!;
  const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const pct = invoice.totalAmount ? Math.round((invoice.paidAmount / invoice.totalAmount) * 100) : 0;
  return (
    <article aria-labelledby={`inv-${invoice.id}`} className="rounded-card border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-border p-4 sm:p-5">
        <Pictogram icon={ReceiptText} tone={remaining ? "warning" : "success"} />
        <div className="min-w-0 flex-1">
          <h3 id={`inv-${invoice.id}`} className="font-sans text-base font-bold">
            <Link href={`/espace/frais/factures/${invoice.id}`} className="underline-offset-4 hover:underline">
              Facture {invoice.number}
            </Link>
          </h3>
          <p className="text-sm text-muted">Émise le {formatDate(invoice.issueDate)}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Total</dt>
            <dd className="font-display text-xl font-bold tabular-nums">{formatFcfa(invoice.totalAmount)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Déjà payé</dt>
            <dd className="font-display text-xl font-bold text-success tabular-nums">{formatFcfa(invoice.paidAmount)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Reste à payer</dt>
            <dd className={cn("font-display text-xl font-bold tabular-nums", remaining ? "text-warning" : "text-success")}>{formatFcfa(remaining)}</dd>
          </div>
        </dl>
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Payé à ${pct} %`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted">Payé à {pct} %</p>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold">Détail</h4>
          <ul className="text-sm">
            {invoice.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 border-b border-border py-1.5 last:border-0">
                <span>{i.description}</span>
                <span className="tabular-nums">{formatFcfa(i.unitPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>

        {invoice.installments.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-bold">Échéancier</h4>
            <ol className="flex flex-col gap-2">
              {invoice.installments.map((t) => {
                const s = INVOICE_STATUS[t.status] ?? INVOICE_STATUS.PENDING!;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="min-w-28 font-semibold">{t.label}</span>
                    <span className="text-muted">Avant le {formatDate(t.dueDate)}</span>
                    <span className="tabular-nums">
                      {formatFcfa(t.paidAmount)} sur {formatFcfa(t.amount)}
                    </span>
                    <Badge tone={s.tone} className="ml-auto">
                      {s.label}
                    </Badge>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-bold">Paiements reçus</h4>
          {invoice.payments.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Coins className="size-4 text-success" aria-hidden />
                  <span className="font-semibold tabular-nums">{formatFcfa(p.amount)}</span>
                  <span>{METHOD[p.method]}</span>
                  <span className="text-muted">le {formatDate(p.paidAt)}</span>
                  <span className="text-muted">Réf. {p.reference}</span>
                  <Link
                    href={`/espace/frais/paiements/${p.id}/recu`}
                    className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    <FileText className="size-4" aria-hidden />
                    Reçu<span className="sr-only"> du paiement {p.reference}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucun paiement enregistré pour le moment.</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function BackToChildren() {
  return (
    <Link href="/espace/suivi" className="inline-flex min-h-11 max-lg:hidden items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline" data-print-hide>
      <ArrowLeft className="size-4" aria-hidden />
      Mes enfants
    </Link>
  );
}

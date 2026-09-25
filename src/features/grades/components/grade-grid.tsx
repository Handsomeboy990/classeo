"use client";

import { AlertTriangle, Lock, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";

import { AverageLevel } from "@/components/kit/level";
import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { parseGradeValue, type EvaluationColumn } from "@/lib/domain/grade-entry";
import { rankEntries, round2, subjectAverage, type Formula, type GradeInput } from "@/lib/domain/grades";
import { formatRank } from "@/lib/domain/report-card";
import { cn, formatAverage } from "@/lib/utils";

import { saveGrades } from "../actions";

type Row = { enrollmentId: string; studentId: string; name: string; matricule: string; values: Record<string, string> };

type Values = Record<string, Record<string, string>>;

function toValues(rows: Row[]): Values {
  return Object.fromEntries(rows.map((r) => [r.enrollmentId, { ...r.values }]));
}

// The grade entry grid: one row per student, one column per evaluation.
// Averages and ranks are recomputed on every keystroke with the same rules as
// the server; only changed cells are sent, in one action.
export function GradeGrid({
  sheetId,
  formula,
  columns,
  rows,
  editable,
  readOnlyReason,
}: {
  sheetId: string;
  formula: Formula;
  columns: EvaluationColumn[];
  rows: Row[];
  editable: boolean;
  readOnlyReason?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Values>(() => toValues(rows));
  const [values, setValues] = useState<Values>(() => toValues(rows));
  const [pending, startTransition] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  // Fresh server data (after a save or a refresh) replaces the baseline.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setSaved(toValues(rows));
    setValues(toValues(rows));
  }

  const computed = useMemo(() => {
    const perRow = rows.map((r) => {
      const grades: GradeInput[] = [];
      const errors: Record<string, string> = {};
      for (const c of columns) {
        const parsed = parseGradeValue(values[r.enrollmentId]?.[c.key] ?? "");
        if (!parsed.ok) errors[c.key] = parsed.error;
        else if (parsed.value !== null) grades.push({ type: c.type, value: parsed.value, maxValue: 20 });
      }
      // A row with an invalid cell has no reliable average, so no rank either.
      const average = Object.keys(errors).length ? null : subjectAverage(formula, grades).average;
      return { id: r.enrollmentId, average, errors };
    });
    const ranks = rankEntries(perRow, (r) => r.average);
    const rankCount = new Map<number, number>();
    for (const r of ranks.values()) if (r !== null) rankCount.set(r, (rankCount.get(r) ?? 0) + 1);
    const colAverages = columns.map((c) => {
      const vals = rows
        .map((r) => parseGradeValue(values[r.enrollmentId]?.[c.key] ?? ""))
        .filter((p): p is { ok: true; value: number } => p.ok && p.value !== null)
        .map((p) => p.value);
      return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    });
    const averages = perRow.map((r) => r.average).filter((a): a is number => a !== null);
    return {
      byId: new Map(perRow.map((r) => [r.id, { ...r, rank: ranks.get(r) ?? null, tied: (rankCount.get(ranks.get(r) ?? -1) ?? 0) > 1 }])),
      colAverages,
      classAverage: averages.length ? round2(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
      errorCount: perRow.reduce((n, r) => n + Object.keys(r.errors).length, 0),
    };
  }, [rows, columns, values, formula]);

  const dirty = useMemo(() => {
    const cells: { enrollmentId: string; key: string }[] = [];
    for (const r of rows)
      for (const c of columns) {
        const now = (values[r.enrollmentId]?.[c.key] ?? "").trim();
        const before = (saved[r.enrollmentId]?.[c.key] ?? "").trim();
        if (now.replace(",", ".") !== before.replace(",", ".")) cells.push({ enrollmentId: r.enrollmentId, key: c.key });
      }
    return cells;
  }, [rows, columns, values, saved]);

  useEffect(() => {
    if (!dirty.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.length]);

  function focusCell(row: number, col: number) {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  }

  function save() {
    if (!dirty.length || pending) return;
    if (computed.errorCount) {
      toast("error", `${computed.errorCount} note${computed.errorCount > 1 ? "s sont invalides" : " est invalide"}. Corrigez les cases en rouge avant d'enregistrer.`);
      const first = tableRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]');
      first?.focus();
      return;
    }
    const cells = dirty.map(({ enrollmentId, key }) => {
      const col = columns.find((c) => c.key === key)!;
      const parsed = parseGradeValue(values[enrollmentId]?.[key] ?? "");
      return { enrollmentId, type: col.type, sequence: col.sequence, value: parsed.ok ? parsed.value : null };
    });
    const snapshot = values;
    startTransition(async () => {
      const result = await saveGrades(null, { sheetId, cells });
      if (result?.ok) {
        setSaved(snapshot);
        toast("success", result.message ?? "Notes enregistrées.");
        router.refresh();
      } else {
        toast("error", result?.message ?? "L'enregistrement a échoué. Vos saisies sont conservées : réessayez.");
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const input = e.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    const allSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    } else if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(e.shiftKey && e.key === "Enter" ? row - 1 : row + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(row - 1, col);
    } else if (e.key === "ArrowRight" && (atEnd || allSelected)) {
      e.preventDefault();
      focusCell(row, col + 1);
    } else if (e.key === "ArrowLeft" && (atStart || allSelected)) {
      e.preventDefault();
      focusCell(row, col - 1);
    } else if (e.key === "Escape") {
      setValues((v) => ({ ...v, [rows[row]!.enrollmentId]: { ...v[rows[row]!.enrollmentId], [columns[col]!.key]: saved[rows[row]!.enrollmentId]?.[columns[col]!.key] ?? "" } }));
    }
  }

  const entered = rows.reduce((n, r) => n + columns.filter((c) => (values[r.enrollmentId]?.[c.key] ?? "").trim() !== "").length, 0);

  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <p>
            <span className="text-muted">Notes saisies : </span>
            <strong className="tabular-nums">
              {entered} / {rows.length * columns.length}
            </strong>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-muted">Moyenne de la classe :</span>
            <AverageLevel average={computed.classAverage} />
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted" aria-live="polite">
              {dirty.length ? `${dirty.length} modification${dirty.length > 1 ? "s" : ""} non enregistrée${dirty.length > 1 ? "s" : ""}` : "Tout est enregistré"}
            </p>
            {dirty.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setValues(saved)} disabled={pending}>
                <RotateCcw aria-hidden /> Annuler les modifications
              </Button>
            )}
            <Button onClick={save} loading={pending} disabled={!dirty.length} aria-keyshortcuts="Control+S">
              {!pending && <Save aria-hidden />}
              {pending ? "Enregistrement…" : "Enregistrer les notes"}
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Lock className="size-4" aria-hidden /> {readOnlyReason ?? "Lecture seule"}
          </p>
        )}
      </div>

      {editable && (
        <p id="grid-help" className="border-b border-border bg-surface-2/60 px-4 py-2 text-xs text-muted">
          Notes sur 20, virgule ou point pour les décimales, case vide si pas de note. Entrée ou flèches pour passer d&apos;une case à l&apos;autre, Échap pour
          annuler une case, Ctrl+S pour enregistrer.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="p-8 text-center text-muted">Aucun élève inscrit dans cette classe.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table ref={tableRef} className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Grille de saisie des notes, une ligne par élève, une colonne par évaluation</caption>
            <thead className="sticky top-0 z-20 bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" className="sticky left-0 z-30 border-b border-border bg-surface-2 px-3 py-3 text-left">
                  Élève
                </th>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className="border-b border-border px-1 py-3 text-center" title={c.label}>
                    <abbr title={c.label} className="no-underline">
                      {c.short}
                    </abbr>
                    <span className="sr-only">{c.label}</span>
                  </th>
                ))}
                <th scope="col" className="border-b border-border px-3 py-3 text-left">
                  Moyenne
                </th>
                <th scope="col" className="border-b border-border px-3 py-3 text-right">
                  Rang
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const info = computed.byId.get(r.enrollmentId)!;
                return (
                  <tr key={r.enrollmentId} className="group">
                    <th scope="row" className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-left font-medium group-hover:bg-surface-2">
                      <Link href={`/espace/eleves/${r.studentId}`} className="block max-w-[14rem] truncate hover:underline" tabIndex={-1}>
                        {r.name}
                      </Link>
                      <span className="block font-mono text-[11px] font-normal text-muted">{r.matricule}</span>
                    </th>
                    {columns.map((c, ci) => {
                      const value = values[r.enrollmentId]?.[c.key] ?? "";
                      const error = info.errors[c.key];
                      const changed = value.trim().replace(",", ".") !== (saved[r.enrollmentId]?.[c.key] ?? "").trim().replace(",", ".");
                      return (
                        <td key={c.key} className="border-b border-border px-1 py-1.5 text-center group-hover:bg-surface-2">
                          {editable ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              maxLength={5}
                              data-row={ri}
                              data-col={ci}
                              value={value}
                              aria-label={`${c.label}, ${r.name}`}
                              aria-invalid={error ? true : undefined}
                              aria-describedby={error ? `err-${r.enrollmentId}-${ci}` : "grid-help"}
                              title={error}
                              onChange={(e) => setValues((v) => ({ ...v, [r.enrollmentId]: { ...v[r.enrollmentId], [c.key]: e.target.value } }))}
                              onKeyDown={(e) => onKeyDown(e, ri, ci)}
                              onFocus={(e) => e.currentTarget.select()}
                              className={cn(
                                "h-10 w-16 rounded-md border bg-surface text-center font-semibold tabular-nums text-text focus:border-primary",
                                error ? "border-danger bg-danger-soft" : changed ? "border-primary bg-primary-soft" : "border-border-strong",
                              )}
                            />
                          ) : (
                            <span className="inline-block w-16 font-semibold tabular-nums">{value || <span className="text-muted">–</span>}</span>
                          )}
                          {error && (
                            <span id={`err-${r.enrollmentId}-${ci}`} className="sr-only">
                              {error}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-border px-3 py-1.5 whitespace-nowrap group-hover:bg-surface-2">
                      {Object.keys(info.errors).length ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-danger">
                          <AlertTriangle className="size-4" aria-hidden /> Note invalide
                        </span>
                      ) : (
                        <AverageLevel average={info.average} />
                      )}
                    </td>
                    <td className="border-b border-border px-3 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums group-hover:bg-surface-2">
                      {formatRank(info.rank, info.tied)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20 bg-surface-2 text-sm font-semibold">
              <tr>
                <th scope="row" className="sticky left-0 z-30 border-t border-border bg-surface-2 px-3 py-2 text-left">
                  Moyenne par évaluation
                </th>
                {computed.colAverages.map((a, i) => (
                  <td key={columns[i]!.key} className="border-t border-border px-1 py-2 text-center tabular-nums">
                    {formatAverage(a)}
                  </td>
                ))}
                <td className="border-t border-border px-3 py-2 tabular-nums">{formatAverage(computed.classAverage)}</td>
                <td className="border-t border-border" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

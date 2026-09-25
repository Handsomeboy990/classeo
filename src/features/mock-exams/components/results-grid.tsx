"use client";

import { Lock, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";

import { AverageLevel } from "@/components/kit/level";
import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { parseGradeValue } from "@/lib/domain/grade-entry";
import { round2 } from "@/lib/domain/grades";
import { cn, formatAverage } from "@/lib/utils";

import { saveResults } from "../actions";

type Row = { enrollmentId: string; name: string; matricule: string; values: Record<string, string> };
type Values = Record<string, Record<string, string>>;

const toValues = (rows: Row[]): Values => Object.fromEntries(rows.map((r) => [r.enrollmentId, { ...r.values }]));
const norm = (v = "") => v.trim().replace(",", ".");

// Entry grid of a mock exam, one row per candidate and one column per
// subject, scores on 20. Same reading rules as the grade grid; only the
// subjects this account may enter are editable, the others are shown.
export function ResultsGrid({
  examId,
  classroomId,
  subjects,
  editable,
  rows,
  readOnlyReason,
}: {
  examId: string;
  classroomId: string;
  subjects: { code: string; name: string }[];
  editable: string[];
  rows: Row[];
  readOnlyReason?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Values>(() => toValues(rows));
  const [values, setValues] = useState<Values>(() => toValues(rows));
  const [prevRows, setPrevRows] = useState(rows);
  const [pending, startTransition] = useTransition();
  const canEdit = useMemo(() => new Set(editable), [editable]);

  if (rows !== prevRows) {
    const fresh = toValues(rows);
    setPrevRows(rows);
    setSaved(fresh);
    setValues(fresh);
  }

  const computed = useMemo(() => {
    let errors = 0;
    const perRow = new Map<string, { average: number | null; errors: Record<string, string> }>();
    for (const r of rows) {
      const nums: number[] = [];
      const errs: Record<string, string> = {};
      for (const s of subjects) {
        const p = parseGradeValue(values[r.enrollmentId]?.[s.code] ?? "");
        if (!p.ok) {
          errs[s.code] = p.error;
          errors++;
        } else if (p.value !== null) nums.push(p.value);
      }
      perRow.set(r.enrollmentId, { average: nums.length && !Object.keys(errs).length ? round2(nums.reduce((a, b) => a + b, 0) / nums.length) : null, errors: errs });
    }
    const colAverages = subjects.map((s) => {
      const nums = rows.map((r) => parseGradeValue(values[r.enrollmentId]?.[s.code] ?? "")).filter((p): p is { ok: true; value: number } => p.ok && p.value !== null);
      return nums.length ? round2(nums.reduce((a, b) => a + b.value, 0) / nums.length) : null;
    });
    return { perRow, colAverages, errors };
  }, [rows, subjects, values]);

  const dirty = useMemo(() => {
    const out: { enrollmentId: string; subjectCode: string }[] = [];
    for (const r of rows) for (const s of subjects) if (canEdit.has(s.code) && norm(values[r.enrollmentId]?.[s.code]) !== norm(saved[r.enrollmentId]?.[s.code])) out.push({ enrollmentId: r.enrollmentId, subjectCode: s.code });
    return out;
  }, [rows, subjects, values, saved, canEdit]);

  useEffect(() => {
    if (!dirty.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.length]);

  function save() {
    if (!dirty.length || pending) return;
    if (computed.errors) {
      toast("error", "Des notes sont invalides. Corrigez les cases en rouge avant d'enregistrer.");
      return;
    }
    const cells = dirty.map((d) => {
      const p = parseGradeValue(values[d.enrollmentId]?.[d.subjectCode] ?? "");
      return { ...d, value: p.ok ? p.value : null };
    });
    const snapshot = values;
    startTransition(async () => {
      const result = await saveResults(null, { examId, classroomId, cells });
      if (result?.ok) {
        setSaved(snapshot);
        toast("success", result.message ?? "Notes enregistrées.");
        router.refresh();
      } else toast("error", result?.message ?? "L'enregistrement a échoué. Vos saisies sont conservées, réessayez.");
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    } else if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? row - 1 : row + 1;
      document.querySelector<HTMLInputElement>(`input[data-mock-row="${next}"][data-mock-col="${col}"]`)?.select();
    }
  }

  return (
    <div className="flex flex-col rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <p className="text-sm text-muted" aria-live="polite">
          {editable.length === 0 ? (
            <span className="inline-flex items-center gap-2 font-semibold">
              <Lock className="size-4" aria-hidden /> {readOnlyReason ?? "Consultation seule"}
            </span>
          ) : dirty.length ? (
            `${dirty.length} modification${dirty.length > 1 ? "s" : ""} non enregistrée${dirty.length > 1 ? "s" : ""}`
          ) : (
            "Tout est enregistré"
          )}
        </p>
        {editable.length > 0 && (
          <div className="flex gap-2">
            {dirty.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setValues(saved)} disabled={pending}>
                <RotateCcw aria-hidden /> Annuler
              </Button>
            )}
            <Button onClick={save} loading={pending} disabled={!dirty.length} aria-keyshortcuts="Control+S">
              {!pending && <Save aria-hidden />} {pending ? "Enregistrement…" : "Enregistrer les notes"}
            </Button>
          </div>
        )}
      </div>
      {editable.length > 0 && (
        <p id="mock-grid-help" className="border-b border-border bg-surface-2/60 px-4 py-2 text-xs text-muted">
          Notes sur 20, virgule ou point pour les décimales, case vide si pas de note. Entrée ou flèches pour changer d&apos;élève, Ctrl+S pour enregistrer.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="p-8 text-center text-muted">Aucun élève inscrit dans cette classe.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Saisie des notes de l&apos;examen blanc, une ligne par élève, une colonne par matière</caption>
            <thead className="sticky top-0 z-20 bg-surface-2 text-xs font-semibold text-muted uppercase">
              <tr>
                <th scope="col" className="sticky left-0 z-30 border-b border-border bg-surface-2 px-3 py-3 text-left">
                  Élève
                </th>
                {subjects.map((s) => (
                  <th key={s.code} scope="col" className="border-b border-border px-1 py-3 text-center" title={s.name}>
                    <abbr title={s.name} className="no-underline">
                      {s.code}
                    </abbr>
                    <span className="sr-only">{s.name}</span>
                  </th>
                ))}
                <th scope="col" className="border-b border-border px-3 py-3 text-left">
                  Moyenne
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const info = computed.perRow.get(r.enrollmentId)!;
                return (
                  <tr key={r.enrollmentId} className="group">
                    <th scope="row" className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-left font-medium group-hover:bg-surface-2">
                      <span className="block max-w-56 truncate">{r.name}</span>
                      <span className="block font-mono text-[11px] font-normal text-muted">{r.matricule}</span>
                    </th>
                    {subjects.map((s, ci) => {
                      const value = values[r.enrollmentId]?.[s.code] ?? "";
                      const error = info.errors[s.code];
                      const changed = norm(value) !== norm(saved[r.enrollmentId]?.[s.code]);
                      return (
                        <td key={s.code} className="border-b border-border px-1 py-1.5 text-center group-hover:bg-surface-2">
                          {canEdit.has(s.code) ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              maxLength={5}
                              data-mock-row={ri}
                              data-mock-col={ci}
                              value={value}
                              aria-label={`${s.name}, ${r.name}`}
                              aria-invalid={error ? true : undefined}
                              aria-describedby="mock-grid-help"
                              title={error}
                              onChange={(e) => setValues((v) => ({ ...v, [r.enrollmentId]: { ...v[r.enrollmentId], [s.code]: e.target.value } }))}
                              onFocus={(e) => e.currentTarget.select()}
                              onKeyDown={(e) => onKeyDown(e, ri, ci)}
                              className={cn(
                                "h-10 w-16 rounded-md border bg-surface text-center font-semibold text-text tabular-nums focus:border-primary",
                                error ? "border-danger bg-danger-soft" : changed ? "border-primary bg-primary-soft" : "border-border-strong",
                              )}
                            />
                          ) : (
                            <span className="inline-block w-16 font-semibold tabular-nums">{value || <span className="text-muted">–</span>}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-border px-3 py-1.5 whitespace-nowrap group-hover:bg-surface-2">
                      <AverageLevel average={info.average} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20 bg-surface-2 text-sm font-semibold">
              <tr>
                <th scope="row" className="sticky left-0 z-30 border-t border-border bg-surface-2 px-3 py-2 text-left">
                  Moyenne par matière
                </th>
                {computed.colAverages.map((a, i) => (
                  <td key={subjects[i]!.code} className="border-t border-border px-1 py-2 text-center tabular-nums">
                    {formatAverage(a)}
                  </td>
                ))}
                <td className="border-t border-border" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

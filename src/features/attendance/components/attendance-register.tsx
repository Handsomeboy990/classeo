"use client";

import { Check, Clock, FileCheck2, Save, UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action";
import { ATTENDANCE_LABELS, attendanceRate, countStatuses, type AttendanceStatusCode } from "@/lib/domain/attendance";
import { cn, formatPercent } from "@/lib/utils";

type Row = { id: string; name: string; detail: string; status: AttendanceStatusCode | null; reason: string };

const OPTIONS: { value: AttendanceStatusCode; Icon: typeof Check; cls: string }[] = [
  { value: "PRESENT", Icon: Check, cls: "peer-checked:border-success peer-checked:bg-success-soft peer-checked:text-success" },
  { value: "ABSENT", Icon: X, cls: "peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger" },
  { value: "LATE", Icon: Clock, cls: "peer-checked:border-warning peer-checked:bg-warning-soft peer-checked:text-warning" },
  { value: "EXCUSED", Icon: FileCheck2, cls: "peer-checked:border-info peer-checked:bg-info-soft peer-checked:text-info" },
];

type State = Record<string, { status: AttendanceStatusCode; reason: string }>;

function initial(rows: Row[]): State {
  // Everyone present by default when nothing was recorded yet.
  return Object.fromEntries(rows.map((r) => [r.id, { status: r.status ?? "PRESENT", reason: r.reason }]));
}

// A register: one row per person, four statuses as a native radio group
// (arrow keys move between them), a reason for anything but present, one save.
export function AttendanceRegister({
  rows,
  action,
  payload,
  idKey,
  editable,
  caption,
}: {
  rows: Row[];
  action: (prev: ActionState, input: never) => Promise<ActionState>;
  payload: Record<string, string>;
  idKey: "enrollmentId" | "teacherId";
  editable: boolean;
  caption: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => initial(rows));
  const [prevRows, setPrevRows] = useState(rows);
  const [pending, startTransition] = useTransition();
  if (rows !== prevRows) {
    setPrevRows(rows);
    setState(initial(rows));
  }

  const counts = useMemo(() => countStatuses(Object.values(state).map((s) => s.status)), [state]);
  const unsaved = rows.some((r) => r.status === null) || rows.some((r) => r.status !== state[r.id]?.status || (r.reason ?? "") !== (state[r.id]?.reason ?? ""));

  function set(id: string, patch: Partial<State[string]>) {
    setState((s) => ({ ...s, [id]: { ...s[id]!, ...patch } }));
  }

  function save() {
    const records = rows.map((r) => ({ [idKey]: r.id, status: state[r.id]!.status, reason: state[r.id]!.reason }));
    startTransition(async () => {
      const result = await action(null, { ...payload, records } as never);
      if (result?.ok) {
        toast("success", result.message ?? "Appel enregistré.");
        router.refresh();
      } else toast("error", result?.message ?? "L'enregistrement a échoué. Réessayez.");
    });
  }

  if (!rows.length) return <p className="p-8 text-center text-muted">Personne à appeler.</p>;

  const saveLabel = pending ? "Enregistrement…" : unsaved ? "Enregistrer l'appel" : "Enregistrer à nouveau";

  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-live="polite">
          {OPTIONS.map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1">
              <o.Icon className="size-4" aria-hidden />
              {ATTENDANCE_LABELS[o.value]} : <strong className="tabular-nums">{counts[o.value] ?? 0}</strong>
            </span>
          ))}
          <span>
            Taux de présence : <strong>{formatPercent(attendanceRate(counts))}</strong>
          </span>
        </p>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setState(Object.fromEntries(rows.map((r) => [r.id, { status: "PRESENT", reason: "" }])))} disabled={pending}>
              <UserCheck aria-hidden /> Tous présents
            </Button>
            {/* Below lg the save button lives in the bar kept above the tab bar. */}
            <Button onClick={save} loading={pending} className="max-lg:hidden">
              {!pending && <Save aria-hidden />}
              {saveLabel}
            </Button>
          </div>
        )}
      </div>
      <ul aria-label={caption} className="divide-y divide-border">
        {rows.map((r) => {
          const s = state[r.id]!;
          return (
            <li key={r.id} className="flex flex-col gap-2.5 px-4 py-3 md:flex-row md:items-center md:gap-4">
              <div className="min-w-0 md:w-56 md:shrink-0">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate font-mono text-xs text-muted">{r.detail}</p>
              </div>
              {/* Phone: four equal choices on one row, 48 px high, icon over
                  the word. From md: the compact pills of the desktop. */}
              <fieldset className="grid grid-cols-4 gap-1.5 md:flex md:flex-wrap" disabled={!editable || pending}>
                <legend className="sr-only">Statut de {r.name}</legend>
                {OPTIONS.map((o) => (
                  <label key={o.value} className="relative min-w-0">
                    <input
                      type="radio"
                      name={`status-${r.id}`}
                      value={o.value}
                      checked={s.status === o.value}
                      onChange={() => set(r.id, { status: o.value })}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control border border-border-strong px-1 text-xs font-semibold text-muted select-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-default md:h-10 md:flex-row md:gap-1.5 md:px-3 md:text-sm",
                        o.cls,
                      )}
                    >
                      <o.Icon className="size-4 shrink-0" aria-hidden />
                      <span className="max-w-full truncate">{ATTENDANCE_LABELS[o.value]}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {s.status !== "PRESENT" && (
                <div className="md:ml-auto md:w-64">
                  <label htmlFor={`reason-${r.id}`} className="sr-only">
                    Motif pour {r.name}
                  </label>
                  <Input
                    id={`reason-${r.id}`}
                    value={s.reason}
                    onChange={(e) => set(r.id, { reason: e.target.value })}
                    placeholder="Motif (facultatif)"
                    maxLength={200}
                    disabled={!editable || pending}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        // An action bar: the floating accessibility button steps aside while
        // it is on the page (globals.css).
        <div
          data-action-bar
          className="sticky bottom-[var(--tab-bar-space)] z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-b-card border-t border-border bg-surface/95 p-3 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur-sm lg:static lg:justify-end lg:p-4 lg:shadow-none lg:backdrop-blur-none"
        >
          <p className="min-w-0 text-sm text-muted lg:hidden">
            <strong className="text-text tabular-nums">{counts.ABSENT ?? 0}</strong> absent{(counts.ABSENT ?? 0) > 1 ? "s" : ""},{" "}
            <strong className="text-text tabular-nums">{counts.LATE ?? 0}</strong> en retard
          </p>
          <Button onClick={save} loading={pending}>
            {!pending && <Save aria-hidden />}
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

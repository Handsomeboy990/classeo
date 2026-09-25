"use client";

import { Check, Clock, FileCheck2, Save, UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";
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
            <Button onClick={save} loading={pending}>
              {!pending && <Save aria-hidden />}
              {pending ? "Enregistrement…" : unsaved ? "Enregistrer l'appel" : "Enregistrer à nouveau"}
            </Button>
          </div>
        )}
      </div>
      <ul aria-label={caption} className="divide-y divide-border">
        {rows.map((r) => {
          const s = state[r.id]!;
          return (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
              <div className="min-w-0 md:w-56 md:shrink-0">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate font-mono text-xs text-muted">{r.detail}</p>
              </div>
              <fieldset className="flex flex-wrap gap-1.5" disabled={!editable || pending}>
                <legend className="sr-only">Statut de {r.name}</legend>
                {OPTIONS.map((o) => (
                  <label key={o.value} className="relative">
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
                        "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-semibold text-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-default",
                        o.cls,
                      )}
                    >
                      <o.Icon className="size-4" aria-hidden />
                      {ATTENDANCE_LABELS[o.value]}
                    </span>
                  </label>
                ))}
              </fieldset>
              {s.status !== "PRESENT" && (
                <div className="md:ml-auto md:w-64">
                  <label htmlFor={`reason-${r.id}`} className="sr-only">
                    Motif pour {r.name}
                  </label>
                  <input
                    id={`reason-${r.id}`}
                    value={s.reason}
                    onChange={(e) => set(r.id, { reason: e.target.value })}
                    placeholder="Motif (facultatif)"
                    maxLength={200}
                    disabled={!editable || pending}
                    className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <div className="flex justify-end border-t border-border p-4">
          <Button onClick={save} loading={pending}>
            {!pending && <Save aria-hidden />}
            {pending ? "Enregistrement…" : "Enregistrer l'appel"}
          </Button>
        </div>
      )}
    </div>
  );
}

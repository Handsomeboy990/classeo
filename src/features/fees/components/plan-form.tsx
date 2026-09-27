"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { useFormState } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { planPercentError, splitByPlan } from "@/lib/domain/payments";
import { cn, formatFcfa } from "@/lib/utils";


type Row = { key: number; label: string; percent: string; dueDate: string };
type Initial = { id: string; name: string; installments: { label: string; percent: number; dueDate: string }[] };

let seq = 0;
const row = (label = "", percent = "", dueDate = ""): Row => ({ key: ++seq, label, percent, dueDate });

// Payment plan editor: installments with a share of the fee and a due date,
// placed in a kit FormDialog that holds the action and the buttons. The live
// total tells the user when the shares reach 100 %; the server checks it
// again.
export function PlanFields({ feeTypeId, amount, initial }: { feeTypeId: string; amount: number; initial?: Initial }) {
  const [name, setName] = useState(initial?.name ?? "Paiement en trois tranches");
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.installments.length
      ? initial.installments.map((i) => row(i.label, String(i.percent), i.dueDate))
      : [row("Tranche 1", "50"), row("Tranche 2", "30"), row("Tranche 3", "20")],
  );

  const percents = rows.map((r) => Number(r.percent));
  const error = planPercentError(percents);
  const sum = percents.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0);
  const shares = error ? null : splitByPlan(amount, percents);

  function update(key: number, patch: Partial<Row>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <>
      <input type="hidden" name="feeTypeId" value={feeTypeId} />
      {initial && <input type="hidden" name="planId" value={initial.id} />}
      <FormField label="Nom de l'échéancier" name="name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">Tranches, de la première à la dernière échéance</legend>
        {rows.map((r, i) => (
          <InstallmentRow
            key={r.key}
            index={i}
            row={r}
            share={shares?.[i]}
            canRemove={rows.length > 1}
            onChange={(patch) => update(r.key, patch)}
            onRemove={() => setRows((list) => list.filter((x) => x.key !== r.key))}
          />
        ))}
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setRows((list) => [...list, row(`Tranche ${list.length + 1}`)])}>
          <Plus aria-hidden /> Ajouter une tranche
        </Button>
      </fieldset>

      <p role="status" className={cn("rounded-control px-3 py-2 text-sm font-semibold", error ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
        Total : {sum} % {error ? `· ${error}` : `· ${formatFcfa(amount)} en ${rows.length} tranche${rows.length > 1 ? "s" : ""}`}
      </p>
      <PlanError />
    </>
  );
}

function PlanError() {
  const state = useFormState();
  const message = state?.fieldErrors?.installments?.[0] ?? state?.fieldErrors?.label?.[0] ?? state?.fieldErrors?.percent?.[0] ?? state?.fieldErrors?.dueDate?.[0];
  if (!message) return null;
  return <p role="alert" className="text-sm font-semibold text-danger">{message}</p>;
}

function InstallmentRow({
  index,
  row: r,
  share,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: Row;
  share?: number;
  canRemove: boolean;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-2 items-end gap-2 rounded-card border border-border p-3 sm:grid-cols-[1.4fr_0.7fr_1.1fr_auto]">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
        <Label htmlFor={`${id}-label`}>Libellé</Label>
        <Input id={`${id}-label`} name="label[]" value={r.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-percent`}>Part</Label>
        <Input id={`${id}-percent`} name="percent[]" type="number" inputMode="numeric" min={1} max={100} step={1} value={r.percent} onChange={(e) => onChange({ percent: e.target.value })} required trailing="%" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-due`}>Échéance</Label>
        <Input id={`${id}-due`} name="dueDate[]" type="date" value={r.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} required />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
        <span className="text-xs text-muted sm:hidden">{share !== undefined ? formatFcfa(share) : ""}</span>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove} aria-label={`Retirer la tranche ${index + 1}`}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      {share !== undefined && <p className="col-span-full text-xs text-muted max-sm:hidden">Montant de la tranche : {formatFcfa(share)}</p>}
    </div>
  );
}

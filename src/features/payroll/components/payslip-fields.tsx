import { FormField } from "@/components/kit/form-field";
import { Input } from "@/components/ui/input";

export type PayslipValues = { baseAmount: number; allowances: number; allowancesNote: string | null; deductions: number; deductionsNote: string | null };

// Fields of a payslip, placed in a kit FormDialog. The net is computed by
// the server: base plus allowances, minus deductions.
export function PayslipFields({ teacherId, month, values }: { teacherId: string; month: string; values?: PayslipValues | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="month" value={month} />
      <FormField label="Salaire de base" name="baseAmount" required className="sm:col-span-2">
        <Input type="number" inputMode="numeric" min={0} step={1} defaultValue={values?.baseAmount ?? ""} trailing="FCFA" />
      </FormField>
      <FormField label="Primes" name="allowances" hint="Heures supplémentaires, transport, ancienneté.">
        <Input type="number" inputMode="numeric" min={0} step={1} defaultValue={values?.allowances ?? 0} trailing="FCFA" />
      </FormField>
      <FormField label="Détail des primes" name="allowancesNote">
        <Input defaultValue={values?.allowancesNote ?? ""} maxLength={200} placeholder="Par exemple : 6 heures supplémentaires" />
      </FormField>
      <FormField label="Retenues" name="deductions" hint="Cotisation CNSS salariale, avance sur salaire.">
        <Input type="number" inputMode="numeric" min={0} step={1} defaultValue={values?.deductions ?? 0} trailing="FCFA" />
      </FormField>
      <FormField label="Détail des retenues" name="deductionsNote">
        <Input defaultValue={values?.deductionsNote ?? ""} maxLength={200} placeholder="Par exemple : CNSS part salariale" />
      </FormField>
    </div>
  );
}

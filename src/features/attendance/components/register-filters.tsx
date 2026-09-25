import { Search } from "lucide-react";

import { Input, Label, Select } from "@/components/ui/input";

// Plain GET form: works without JavaScript and keeps the choice in the URL.
export function RegisterFilters({
  action,
  classes,
  classroomId,
  date,
  half,
  maxDate,
}: {
  action: string;
  classes?: { id: string; name: string }[];
  classroomId?: string;
  date: string;
  half?: string;
  maxDate: string;
}) {
  return (
    <form method="get" action={action} className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {classes && (
        <div className="flex flex-col gap-1.5 sm:w-52">
          <Label htmlFor="f-classe">Classe</Label>
          <Select id="f-classe" name="classe" defaultValue={classroomId}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5 sm:w-48">
        <Label htmlFor="f-date">Date</Label>
        <Input id="f-date" type="date" name="date" defaultValue={date} max={maxDate} required />
      </div>
      {half && (
        <div className="flex flex-col gap-1.5 sm:w-44">
          <Label htmlFor="f-demi">Demi-journée</Label>
          <Select id="f-demi" name="demi" defaultValue={half}>
            <option value="MORNING">Matin</option>
            <option value="AFTERNOON">Après-midi</option>
          </Select>
        </div>
      )}
      <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
        <Search className="size-4" aria-hidden /> Afficher
      </button>
    </form>
  );
}

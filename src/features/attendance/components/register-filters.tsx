import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <form method="get" action={action} className="mb-6 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      {classes && (
        <div className="flex min-w-0 flex-col gap-1.5 sm:w-52">
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
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-48">
        <Label htmlFor="f-date">Date</Label>
        <Input id="f-date" type="date" name="date" defaultValue={date} max={maxDate} required />
      </div>
      {half && (
        <div className="flex min-w-0 flex-col gap-1.5 sm:w-44">
          <Label htmlFor="f-demi">Demi-journée</Label>
          <Select id="f-demi" name="demi" defaultValue={half}>
            <option value="MORNING">Matin</option>
            <option value="AFTERNOON">Après-midi</option>
          </Select>
        </div>
      )}
      <Button type="submit" variant="secondary">
        <Search aria-hidden /> Afficher
      </Button>
    </form>
  );
}

import { UrlSelect } from "@/components/kit/url-select";

import type { YearOption } from "../queries";
import { YEAR_STATUS_LABELS } from "../rules";

// Year selector of the pages that show one year's data: ?annee=<id>. A
// closed year is labelled as such, and stays fully readable.
export function YearSelect({ options, value, label = "Année scolaire", className }: { options: YearOption[]; value: string | null | undefined; label?: string; className?: string }) {
  if (options.length < 2) return null;
  return (
    <UrlSelect
      param="annee"
      label={label}
      value={value ?? ""}
      options={options.map((o) => ({ value: o.id, label: o.status === "ACTIVE" ? o.label : `${o.label} (${YEAR_STATUS_LABELS[o.status].toLowerCase()})` }))}
      className={className ?? "sm:w-56"}
    />
  );
}

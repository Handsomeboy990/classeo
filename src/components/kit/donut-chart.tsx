import { cn, formatNumber, formatPercent } from "@/lib/utils";

import { DonutRing } from "./donut-ring";
import { EmptyState } from "./states";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// Donut for a share of a whole (girls and boys, payment modes): few parts,
// each drawn with a thin gap, the total in the middle, and a legend that
// gives every part's value and percentage in words. Formatted here, on the
// server; DonutRing adds the highlight on hover, touch or focus. With a
// total of zero, an empty state instead of an empty ring.
export function DonutChart({
  data,
  label,
  total: totalLabel,
  format = formatNumber,
  empty = "Aucune donnée pour le moment.",
  className,
}: {
  data: { label: string; value: number; color?: string }[];
  label: string;
  // Text under the number in the middle, e.g. "élèves".
  total?: string;
  format?: (n: number) => string;
  empty?: string;
  className?: string;
}) {
  const sum = data.reduce((n, d) => n + d.value, 0);
  if (sum <= 0) return <EmptyState title={empty} className={cn("py-8", className)} />;
  return (
    <div className={cn("min-w-0", className)}>
      <DonutRing
        label={label}
        total={format(sum)}
        totalLabel={totalLabel}
        parts={data.map((d, i) => ({ label: d.label, value: d.value, color: d.color ?? COLORS[i % COLORS.length]!, display: format(d.value), share: formatPercent(d.value / sum) }))}
      />
    </div>
  );
}

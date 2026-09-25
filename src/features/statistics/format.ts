import { INDICATORS, type IndicatorKey } from "@/lib/domain/indicators";
import { formatAverage, formatNumber, formatPercent } from "@/lib/utils";

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function formatIndicator(key: IndicatorKey, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  switch (INDICATORS[key].format) {
    case "number":
      return formatNumber(value);
    case "percent":
      return formatPercent(value, 1);
    case "decimal":
      return decimal.format(value);
    case "average":
      return `${formatAverage(value)}/20`;
  }
}

// Formatter for BarChart, which receives plain numbers.
export function indicatorFormatter(key: IndicatorKey) {
  return (n: number) => formatIndicator(key, n);
}

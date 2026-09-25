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

// Absence rates are read on a fixed 0 to 20 % scale, so 8 % and 9,5 % do not
// both fill the track; beyond 10 % a rate is an alert. Warning and danger
// tones, never the flag yellow, which is unreadable on a light card.
export const ABSENCE_SCALE = 0.2;
export const ABSENCE_ALERT = 0.1;

export function absenceTone(rate: number) {
  return rate > ABSENCE_ALERT ? ("danger" as const) : ("warning" as const);
}

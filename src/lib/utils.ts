import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fcfa = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export function formatFcfa(amount: number) {
  return `${fcfa.format(amount)} FCFA`;
}

const number = new Intl.NumberFormat("fr-FR");
export function formatNumber(n: number) {
  return number.format(n);
}

export function formatPercent(ratio: number | null, digits = 0) {
  if (ratio === null || Number.isNaN(ratio)) return "–";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")} %`;
}

export function formatAverage(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  return n.toFixed(2).replace(".", ",");
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" });
export function formatDate(d: Date | string) {
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Porto-Novo",
});
export function formatDateTime(d: Date | string) {
  return dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

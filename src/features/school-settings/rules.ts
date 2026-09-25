// Payment accounts parents pay the school to. Pure rules, unit tested.

export const MOBILE_MONEY_PROVIDERS = ["MTN MoMo", "Moov Money", "Celtiis Cash"] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

export const CHANNEL_LABELS = { MOBILE_MONEY: "Mobile Money", BANK: "Compte bancaire" } as const;

export const MAX_PAYMENT_ACCOUNTS = 10;

// Benin mobile numbers have ten digits since 2024 (01 then eight digits);
// the country code is optional. Stored as "+229 01 97 12 34 56".
export function normalizeMobileNumber(raw: string): string | null {
  let digits = raw.replace(/[\s.()-]/g, "");
  if (digits.startsWith("+229")) digits = digits.slice(4);
  else if (digits.startsWith("00229")) digits = digits.slice(5);
  if (/^\d{8}$/.test(digits)) digits = `01${digits}`;
  if (!/^01\d{8}$/.test(digits)) return null;
  return `+229 ${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}

// A bank account: an IBAN (BJ + 26 characters) or a RIB of 10 to 34 letters
// and digits. Stored in upper case without spaces, shown grouped by four.
export function normalizeBankAccount(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{10,34}$/.test(compact)) return null;
  if (compact.startsWith("BJ") && compact.length !== 28) return null;
  return compact;
}

export function groupByFour(value: string) {
  return value.replace(/(.{4})(?=.)/g, "$1 ");
}

// A school web address: http or https only, never a script.
export function normalizeWebsite(raw: string): string | null {
  const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

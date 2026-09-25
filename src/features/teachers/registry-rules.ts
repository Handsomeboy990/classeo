// National teacher registry: how a search is read and how names compare.
// Pure functions, unit tested; registry.ts runs the queries.

// Lower case without accents, spaces squeezed: "Hounkpatin Sènami" and
// "hounkpatin senami" are the same name.
export function foldName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Accented letters PostgreSQL folds with translate(), the same set as
// foldName for the names of Benin (French spelling, Fon and Yoruba vowels).
export const SQL_ACCENTS_FROM = "àáâäãåāçèéêëēěìíîïīñòóôöõōùúûüūýÿɛɔ";
export const SQL_ACCENTS_TO = "aaaaaaaceeeeeeiiiiinoooooouuuuuyyeo";

export const NPI_PATTERN = /^\d{10}$/;

export function digitsOf(value: string) {
  return value.replace(/\D/g, "");
}

// A Benin number moved from 8 to 10 digits by adding "01" in front: the last
// eight digits identify a line either way.
export function phoneKey(value: string | null | undefined) {
  const d = digitsOf(value ?? "");
  return d.length >= 8 ? d.slice(-8) : null;
}

export type RegistryQuery = { npi: string | null; phone: string | null; names: string[] };

// One search box: digits are an NPI or a phone number, words are names
// (first and last, in any order). Null when there is nothing to search.
export function parseRegistryQuery(input: string): RegistryQuery | null {
  const raw = input.trim();
  if (!raw) return null;
  const digits = digitsOf(raw);
  if (/^[\d\s+.-]+$/.test(raw)) {
    if (digits.length < 8) return null;
    return { npi: NPI_PATTERN.test(digits) ? digits : null, phone: phoneKey(digits), names: [] };
  }
  const names = foldName(raw)
    .split(" ")
    .map((t) => t.replace(/[%_\\]/g, ""))
    .filter((t) => t.length >= 2);
  return names.length ? { npi: null, phone: null, names } : null;
}

// "•• •• 45 12": enough for the person who typed the number to recognise
// it, not a directory of phone numbers.
export function maskPhone(value: string | null | undefined) {
  const d = digitsOf(value ?? "");
  if (d.length < 4) return null;
  return `•• •• ${d.slice(-4, -2)} ${d.slice(-2)}`;
}

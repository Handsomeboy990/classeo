import type { Prisma } from "@/generated/prisma/client";

// Sign in identifiers are built from the person's names: "afiavi.hounkpatin",
// then "afiavi.hounkpatin2" when the name is already taken. No e-mail needed.

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’\s-]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function usernameBase(firstName: string, lastName: string) {
  const first = fold(firstName) || "utilisateur";
  const last = fold(lastName);
  return last ? `${first}.${last}` : first;
}

// The smallest free identifier for a base, given the identifiers already
// taken that start with it.
export function nextFreeUsername(base: string, taken: string[]) {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
}

type Client = { user: { findMany: (args: Prisma.UserFindManyArgs) => Promise<{ username: string }[]> } };

export async function allocateUsername(client: Client, firstName: string, lastName: string) {
  const base = usernameBase(firstName, lastName);
  const rows = await client.user.findMany({ where: { username: { startsWith: base } }, select: { username: true } });
  return nextFreeUsername(base, rows.map((r) => r.username));
}

export function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

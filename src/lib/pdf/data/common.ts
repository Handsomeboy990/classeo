import type { Issuer } from "../layout";

// Identifiers read from the URL: anything else is refused before a query.
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const validId = (id: string | null | undefined): id is string => !!id && ID.test(id);

export const schoolSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  phone: true,
  email: true,
  commune: { select: { name: true, department: { select: { name: true } } } },
} as const;

type SchoolRow = { name: string; code: string; address: string | null; phone: string | null; email?: string | null; commune: { name: string; department: { name: string } } };

export function schoolIssuer(s: SchoolRow): Issuer {
  return { kind: "school", name: s.name, address: s.address, place: `${s.commune.name}, ${s.commune.department.name}`, phone: s.phone, email: s.email ?? null, code: s.code };
}

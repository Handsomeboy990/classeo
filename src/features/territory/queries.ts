import "server-only";

import { cached, tags } from "@/lib/cache";
import { db } from "@/lib/db";

import type { StatScope } from "./scope";

// Reference lists of the territory. They are public administrative data and
// change rarely, so they are cached for everyone; callers still filter them by
// the user's scope before showing them.
export const listDepartments = cached(() => db.department.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }), ["territory", "departments"], {
  tags: [tags.territory],
  revalidate: 3600,
});

export const listCommunes = cached(
  () => db.commune.findMany({ select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
  ["territory", "communes"],
  { tags: [tags.territory], revalidate: 3600 },
);

export async function communesOf(departmentId: string) {
  return (await listCommunes()).filter((c) => c.departmentId === departmentId);
}

// Human readable name of a statistics scope, with its parents.
export async function scopeTitle(scope: StatScope): Promise<{ name: string; trail: string[] }> {
  switch (scope.level) {
    case "NATIONAL":
      return { name: "Bénin", trail: ["Bénin"] };
    case "DEPARTMENT": {
      const d = await db.department.findUnique({ where: { id: scope.id }, select: { name: true } });
      return { name: d?.name ?? "Département", trail: ["Bénin", d?.name ?? ""] };
    }
    case "COMMUNE": {
      const c = await db.commune.findUnique({ where: { id: scope.id }, select: { name: true, department: { select: { name: true } } } });
      return { name: c?.name ?? "Commune", trail: ["Bénin", c?.department.name ?? "", c?.name ?? ""] };
    }
    case "SCHOOL": {
      const s = await db.school.findUnique({
        where: { id: scope.id },
        select: { name: true, commune: { select: { name: true, department: { select: { name: true } } } } },
      });
      return { name: s?.name ?? "Établissement", trail: ["Bénin", s?.commune.department.name ?? "", s?.commune.name ?? "", s?.name ?? ""] };
    }
  }
}

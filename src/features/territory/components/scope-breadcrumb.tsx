import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SCOPE_RANK } from "@/lib/domain/rights";

import type { StatScope } from "../scope";

type Crumb = { label: string; level: "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL"; departmentId?: string; communeId?: string; schoolId?: string };

async function crumbsOf(scope: StatScope): Promise<Crumb[]> {
  const root: Crumb = { label: "Bénin", level: "NATIONAL" };
  switch (scope.level) {
    case "NATIONAL":
      return [root];
    case "DEPARTMENT": {
      const d = await db.department.findUnique({ where: { id: scope.id }, select: { id: true, name: true } });
      return d ? [root, { label: d.name, level: "DEPARTMENT", departmentId: d.id }] : [root];
    }
    case "COMMUNE": {
      const c = await db.commune.findUnique({ where: { id: scope.id }, select: { id: true, name: true, department: { select: { id: true, name: true } } } });
      if (!c) return [root];
      return [
        root,
        { label: c.department.name, level: "DEPARTMENT", departmentId: c.department.id },
        { label: c.name, level: "COMMUNE", departmentId: c.department.id, communeId: c.id },
      ];
    }
    case "SCHOOL": {
      const s = await db.school.findUnique({
        where: { id: scope.id },
        select: { id: true, name: true, commune: { select: { id: true, name: true, department: { select: { id: true, name: true } } } } },
      });
      if (!s) return [root];
      const dep = s.commune.department;
      return [
        root,
        { label: dep.name, level: "DEPARTMENT", departmentId: dep.id },
        { label: s.commune.name, level: "COMMUNE", departmentId: dep.id, communeId: s.commune.id },
        { label: s.name, level: "SCHOOL", departmentId: dep.id, communeId: s.commune.id, schoolId: s.id },
      ];
    }
  }
}

function hrefOf(c: Crumb, basePath: "/espace/statistiques" | "/espace/territoire" | "/espace/comparaison") {
  if (basePath === "/espace/territoire") {
    if (c.level === "NATIONAL") return "/espace/territoire";
    if (c.level === "DEPARTMENT") return `/espace/territoire/${c.departmentId}`;
    if (c.level === "COMMUNE") return `/espace/territoire/commune/${c.communeId}`;
    return `/espace/etablissements/${c.schoolId}`;
  }
  const q = new URLSearchParams();
  if (c.level === "DEPARTMENT" || c.level === "COMMUNE") q.set("departement", c.departmentId!);
  if (c.level === "COMMUNE") q.set("commune", c.communeId!);
  return q.size ? `${basePath}?${q}` : basePath;
}

// Bénin > Département > Commune > Établissement. Levels above the user's own
// are shown as plain text: the server would refuse them anyway.
export async function ScopeBreadcrumb({
  scope,
  basePath,
  user,
}: {
  scope: StatScope;
  basePath: "/espace/statistiques" | "/espace/territoire" | "/espace/comparaison";
  user: NonNullable<CurrentUser>;
}) {
  const crumbs = await crumbsOf(scope);
  const myRank = SCOPE_RANK[user.scope.level];
  return (
    <nav aria-label="Fil d'Ariane territorial">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        <li aria-hidden>
          <MapPin className="size-4 text-muted" />
        </li>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const reachable = SCOPE_RANK[c.level] <= myRank;
          return (
            <li key={c.level} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-4 text-muted" aria-hidden />}
              {last ? (
                <span aria-current="page" className="font-semibold text-text">
                  {c.label}
                </span>
              ) : reachable ? (
                <Link href={hrefOf(c, basePath)} className="text-primary hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-muted">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

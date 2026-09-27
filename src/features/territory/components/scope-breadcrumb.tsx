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
  // Styled as the kit trail (doc 4.8): small muted text, chevron
  // separators, the current level in the body colour.
  return (
    <nav aria-label="Fil d'Ariane territorial">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[0.8125rem] text-muted">
        <li aria-hidden className="mr-0.5 inline-flex">
          <MapPin className="size-3.5" />
        </li>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const reachable = SCOPE_RANK[c.level] <= myRank;
          return (
            <li key={c.level} className="inline-flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              {last ? (
                <span aria-current="page" className="font-semibold text-text">
                  {c.label}
                </span>
              ) : reachable ? (
                <Link href={hrefOf(c, basePath)} className="inline-flex min-h-11 items-center underline underline-offset-3 hover:text-text sm:min-h-0">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

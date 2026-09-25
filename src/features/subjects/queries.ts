import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { param, type SearchParams } from "@/lib/list";

import { isSubjectStatus, type SubjectStatus } from "./labels";

type User = NonNullable<CurrentUser>;

export type SubjectFilters = { q: string; status: SubjectStatus };

export function subjectFilters(sp: SearchParams): SubjectFilters {
  const statut = param(sp, "statut");
  return { q: (param(sp, "q") ?? "").trim().slice(0, 100), status: isSubjectStatus(statut) ? statut : "APPROVED" };
}

// The approved catalogue is national and read by everyone allowed. Pending
// and refused proposals are visible to the ministry, and to the territory of
// the proposing school (a school sees only its own).
export function subjectWhere(user: User, f?: Partial<SubjectFilters>): Prisma.SubjectWhereInput {
  const and: Prisma.SubjectWhereInput[] = [];
  const status = f?.status ?? "APPROVED";
  and.push({ status });
  if (status !== "APPROVED" && user.scope.level !== "NATIONAL") and.push({ requestedBySchool: { is: schoolWhere(user) } });
  if (f?.q) and.push({ OR: [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q, mode: "insensitive" } }] });
  return { AND: and };
}

export async function listSubjects(user: User, f: SubjectFilters, page: { skip: number; take: number }) {
  const where = subjectWhere(user, f);
  const [rows, total, counts] = await Promise.all([
    db.subject.findMany({
      where,
      orderBy: f.status === "APPROVED" ? [{ name: "asc" }, { code: "asc" }] : [{ code: "asc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        decisionNote: true,
        requestedBySchool: { select: { id: true, name: true, commune: { select: { name: true } } } },
        _count: { select: { assignments: true } },
      },
    }),
    db.subject.count({ where }),
    Promise.all((["APPROVED", "PENDING", "REJECTED"] as const).map((s) => db.subject.count({ where: subjectWhere(user, { status: s }) }))),
  ]);
  return { rows, total, byStatus: { APPROVED: counts[0], PENDING: counts[1], REJECTED: counts[2] } as Record<SubjectStatus, number> };
}

// Subjects a course assignment may use: the approved catalogue only.
export function approvedSubjects() {
  return db.subject.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true }, take: 500 });
}

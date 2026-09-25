import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { param, type SearchParams } from "@/lib/list";

import { isRequestStatus, isRequestType, type RequestStatus, type RequestType } from "./labels";

type User = NonNullable<CurrentUser>;

export type RequestFilters = { q: string; status: RequestStatus | null; type: RequestType | null };

export function requestFilters(sp: SearchParams): RequestFilters {
  const statut = param(sp, "statut");
  const type = param(sp, "type");
  return { q: (param(sp, "q") ?? "").trim().slice(0, 100), status: isRequestStatus(statut) ? statut : null, type: isRequestType(type) ? type : null };
}

// Requests are always read through the school's scope.
export function requestWhere(user: User, f?: RequestFilters): Prisma.SchoolRequestWhereInput {
  const and: Prisma.SchoolRequestWhereInput[] = [{ school: schoolWhere(user) }];
  if (f?.q) and.push({ OR: [{ subject: { contains: f.q, mode: "insensitive" } }, { school: { name: { contains: f.q, mode: "insensitive" } } }] });
  if (f?.status) and.push({ status: f.status });
  if (f?.type) and.push({ type: f.type });
  return { AND: and };
}

const listSelect = {
  id: true,
  type: true,
  subject: true,
  status: true,
  createdAt: true,
  decidedAt: true,
  school: { select: { id: true, name: true, commune: { select: { name: true } } } },
  author: { select: { firstName: true, lastName: true } },
} as const;

export async function listRequests(user: User, f: RequestFilters, page: { skip: number; take: number }) {
  const where = requestWhere(user, f);
  const [rows, total, counts] = await Promise.all([
    db.schoolRequest.findMany({ where, select: listSelect, orderBy: [{ createdAt: "desc" }], skip: page.skip, take: page.take }),
    db.schoolRequest.count({ where }),
    db.schoolRequest.groupBy({ by: ["status"], where: requestWhere(user), _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<RequestStatus, number>>;
  return { rows, total, byStatus };
}

export function recentPendingRequests(user: User, take = 5) {
  return db.schoolRequest.findMany({ where: { AND: [requestWhere(user), { status: "PENDING" }] }, select: listSelect, orderBy: { createdAt: "asc" }, take });
}

export function getRequest(user: User, id: string) {
  return db.schoolRequest.findFirst({
    where: { AND: [{ id }, requestWhere(user)] },
    select: {
      ...listSelect,
      body: true,
      decisionNote: true,
      school: { select: { id: true, name: true, code: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
      author: { select: { firstName: true, lastName: true, email: true } },
      decider: { select: { firstName: true, lastName: true, role: { select: { name: true } } } },
    },
  });
}

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { param, type SearchParams } from "@/lib/list";

import { DOC_STATUSES, isDocStatus, type DocStatus } from "./labels";

type User = NonNullable<CurrentUser>;

export type DocFilters = { q: string; status: DocStatus | null };

export function docFilters(sp: SearchParams): DocFilters {
  const statut = param(sp, "statut");
  return { q: (param(sp, "q") ?? "").trim().slice(0, 100), status: isDocStatus(statut) ? statut : null };
}

// Requests are always read through the school's scope: an authority sees the
// schools of its territory, a school its own requests. Families never reach
// them (the section permission is staff only, and SELF scope is refused).
export function docWhere(user: User, f?: DocFilters): Prisma.DocumentRequestWhereInput {
  if (user.scope.level === "SELF") return { id: "__none__" };
  const and: Prisma.DocumentRequestWhereInput[] = [{ school: schoolWhere(user) }];
  if (f?.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { school: { name: { contains: f.q, mode: "insensitive" } } }] });
  if (f?.status) and.push({ status: f.status });
  return { AND: and };
}

const listSelect = {
  id: true,
  title: true,
  status: true,
  dueDate: true,
  createdAt: true,
  requestedById: true,
  school: { select: { id: true, name: true, commune: { select: { name: true } } } },
  _count: { select: { files: true } },
} as const;

// Names of the agents who asked, looked up once for the page.
async function requesterNames(ids: string[]) {
  const users = await db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } });
  return new Map(users.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`, role: u.role.name }]));
}

export async function listDocRequests(user: User, f: DocFilters, page: { skip: number; take: number }) {
  const where = docWhere(user, f);
  const [rows, total, counts] = await Promise.all([
    db.documentRequest.findMany({ where, select: listSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: page.skip, take: page.take }),
    db.documentRequest.count({ where }),
    db.documentRequest.groupBy({ by: ["status"], where: docWhere(user), _count: { _all: true } }),
  ]);
  const names = await requesterNames(rows.map((r) => r.requestedById));
  const byStatus = Object.fromEntries(DOC_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0])) as Record<DocStatus, number>;
  return { rows: rows.map((r) => ({ ...r, requester: names.get(r.requestedById) ?? null })), total, byStatus };
}

export async function getDocRequest(user: User, id: string) {
  const request = await db.documentRequest.findFirst({
    where: { AND: [{ id }, docWhere(user)] },
    select: {
      ...listSelect,
      description: true,
      responseNote: true,
      reviewedAt: true,
      reviewedById: true,
      school: { select: { id: true, name: true, code: true, commune: { select: { name: true, department: { select: { name: true } } } } } },
      files: { orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, uploadedById: true, file: { select: { id: true, fileName: true, mimeType: true, size: true } } } },
    },
  });
  if (!request) return null;
  const names = await requesterNames([request.requestedById, ...(request.reviewedById ? [request.reviewedById] : []), ...request.files.map((f) => f.uploadedById)]);
  return { ...request, names };
}

// Schools an authority may ask, for the picker.
export function requestableSchools(user: User) {
  return db.school.findMany({ where: schoolWhere(user), orderBy: { name: "asc" }, take: 2000, select: { id: true, name: true, code: true, commune: { select: { name: true } } } });
}

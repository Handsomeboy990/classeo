import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CHAIN_CYCLES, chainOfCycle } from "@/lib/domain/chains";

import { helpRouteLevel, MANAGE_USERS } from "./routing";

type User = NonNullable<CurrentUser>;

const NOTHING: Prisma.PasswordHelpRequestWhereInput = { id: "__none__" };

const manages: Prisma.UserWhereInput = { role: { permissions: { some: { permission: { code: MANAGE_USERS } } } } };
const doesNotManage: Prisma.UserWhereInput = { role: { permissions: { none: { permission: { code: MANAGE_USERS } } } } };

const enrolledIn = (schoolId: string): Prisma.EnrollmentListRelationFilter => ({
  some: { schoolId, status: "ACTIVE", academicYear: { isActive: true } },
});

// Requests the user handles: routed to their level (routing.ts), from an
// account inside their territory. The mirror of handlerWhere below.
export function helpRequestWhere(user: User): Prisma.PasswordHelpRequestWhereInput {
  if (!can(user, MANAGE_USERS)) return NOTHING;
  const s = user.scope;
  const notMe: Prisma.UserWhereInput = { id: { not: user.id } };
  switch (s.level) {
    case "SCHOOL":
      if (!s.schoolId) return NOTHING;
      return {
        user: {
          AND: [
            notMe,
            {
              OR: [
                { AND: [{ scopeLevel: "SCHOOL", schoolId: s.schoolId }, doesNotManage] },
                {
                  scopeLevel: "SELF",
                  OR: [{ student: { enrollments: enrolledIn(s.schoolId) } }, { guardian: { students: { some: { student: { enrollments: enrolledIn(s.schoolId) } } } } }],
                },
              ],
            },
          ],
        },
      };
    case "COMMUNE":
      if (!s.communeId) return NOTHING;
      return { user: { AND: [notMe, { scopeLevel: "SCHOOL", school: { communeId: s.communeId, cycle: { in: CHAIN_CYCLES.PRIMARY } } }, manages] } };
    case "DEPARTMENT": {
      if (!s.departmentId) return NOTHING;
      // The circonscriptions for a DDEMP, the heads of secondary schools for
      // a DDESTFP, both for an account without a chain.
      const or: Prisma.UserWhereInput[] = [];
      if (!s.chain || s.chain === "PRIMARY") or.push({ scopeLevel: "COMMUNE", commune: { departmentId: s.departmentId } });
      if (!s.chain || s.chain === "SECONDARY") or.push({ AND: [{ scopeLevel: "SCHOOL", school: { commune: { departmentId: s.departmentId }, cycle: { in: CHAIN_CYCLES.SECONDARY } } }, manages] });
      return { user: { AND: [notMe, { OR: or }] } };
    }
    case "NATIONAL":
      return { user: { AND: [notMe, { scopeLevel: { in: ["DEPARTMENT", "NATIONAL"] } }] } };
    case "SELF":
      return NOTHING;
  }
}

export async function pendingHelpCount(user: User) {
  if (!can(user, MANAGE_USERS)) return 0;
  return db.passwordHelpRequest.count({ where: { AND: [{ status: "PENDING" }, helpRequestWhere(user)] } });
}

export type HelpStatusFilter = "PENDING" | "RESOLVED" | "REJECTED" | null;

export async function listHelpRequests(user: User, status: HelpStatusFilter, page: { skip: number; take: number }) {
  const where: Prisma.PasswordHelpRequestWhereInput = { AND: [helpRequestWhere(user), status ? { status } : {}] };
  const [rows, total] = await Promise.all([
    db.passwordHelpRequest.findMany({
      where,
      // Waiting requests first, the oldest on top: they have waited longest.
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        status: true,
        contact: true,
        note: true,
        createdAt: true,
        handledAt: true,
        handler: { select: { firstName: true, lastName: true } },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            role: { select: { name: true } },
            school: { select: { name: true } },
            commune: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    }),
    db.passwordHelpRequest.count({ where }),
  ]);
  return { rows, total };
}

// Accounts that will see a new request: those holding user:update at the
// level and in the entity the request is routed to.
export async function handlerIds(requesterId: string) {
  const r = await db.user.findUnique({
    where: { id: requesterId },
    select: {
      scopeLevel: true,
      schoolId: true,
      communeId: true,
      departmentId: true,
      school: { select: { communeId: true, cycle: true, commune: { select: { departmentId: true } } } },
      commune: { select: { departmentId: true } },
      role: { select: { permissions: { where: { permission: { code: MANAGE_USERS } }, select: { permissionId: true } } } },
      student: { select: { enrollments: { where: { status: "ACTIVE", academicYear: { isActive: true } }, select: { schoolId: true } } } },
      guardian: { select: { students: { select: { student: { select: { enrollments: { where: { status: "ACTIVE", academicYear: { isActive: true } }, select: { schoolId: true } } } } } } } },
    },
  });
  if (!r) return [];
  const level = helpRouteLevel({ scopeLevel: r.scopeLevel, managesUsers: r.role.permissions.length > 0, schoolCycle: r.school?.cycle });
  let where: Prisma.UserWhereInput | null = null;
  if (level === "SCHOOL") {
    const schoolIds =
      r.scopeLevel === "SELF"
        ? [...(r.student?.enrollments ?? []), ...(r.guardian?.students.flatMap((s) => s.student.enrollments) ?? [])].map((e) => e.schoolId)
        : r.schoolId
          ? [r.schoolId]
          : [];
    if (schoolIds.length) where = { scopeLevel: "SCHOOL", schoolId: { in: [...new Set(schoolIds)] } };
  } else if (level === "COMMUNE" && r.school) where = { scopeLevel: "COMMUNE", communeId: r.school.communeId };
  else if (level === "DEPARTMENT" && r.commune) where = { scopeLevel: "DEPARTMENT", departmentId: r.commune.departmentId, OR: [{ chain: null }, { chain: "PRIMARY" }] };
  else if (level === "DEPARTMENT" && r.school) where = { scopeLevel: "DEPARTMENT", departmentId: r.school.commune.departmentId, OR: [{ chain: null }, { chain: chainOfCycle(r.school.cycle) }] };
  else if (level === "NATIONAL") where = { scopeLevel: "NATIONAL" };
  if (!where) return [];
  const rows = await db.user.findMany({ where: { AND: [where, manages, { isActive: true, id: { not: requesterId } }] }, select: { id: true }, take: 50 });
  return rows.map((u) => u.id);
}

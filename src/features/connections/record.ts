import "server-only";

import { headers } from "next/headers";

import type { ConnectionOutcome, SchoolCycle } from "@/generated/prisma/client";
import { clientIp } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { chainOfCycle } from "@/lib/domain/chains";

import { parseUserAgent } from "./user-agent";

// The territory of an account at the time of the event: its own for a
// territorial account, its school's for school staff, the school of the
// first child followed for a family (a parent has no territory of its
// own). Copied on the event so the statistics of a territory do not move
// when the account does.
async function snapshot(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      scopeLevel: true,
      chain: true,
      departmentId: true,
      communeId: true,
      schoolId: true,
      role: { select: { code: true } },
      commune: { select: { departmentId: true } },
      school: { select: { id: true, cycle: true, communeId: true, commune: { select: { departmentId: true } } } },
      teachers: { where: { isActive: true }, take: 1, select: { school: { select: { id: true, cycle: true, communeId: true, commune: { select: { departmentId: true } } } } } },
    },
  });
  if (!u) return null;
  type SchoolRef = { id: string; cycle: SchoolCycle; communeId: string; commune: { departmentId: string } };
  let school: SchoolRef | null = u.school ?? u.teachers[0]?.school ?? null;
  if (u.scopeLevel === "SELF" && !school) {
    const enrollment = await db.enrollment.findFirst({
      where: { academicYear: { isActive: true }, student: { OR: [{ userId }, { guardians: { some: { guardian: { userId } } } }] } },
      orderBy: { enrolledAt: "asc" },
      select: { school: { select: { id: true, cycle: true, communeId: true, commune: { select: { departmentId: true } } } } },
    });
    school = enrollment?.school ?? null;
  }
  const territorial = u.scopeLevel === "NATIONAL" || u.scopeLevel === "DEPARTMENT" || u.scopeLevel === "COMMUNE";
  return {
    roleCode: u.role.code,
    scopeLevel: u.scopeLevel,
    departmentId: territorial ? (u.departmentId ?? u.commune?.departmentId ?? null) : (school?.commune.departmentId ?? null),
    communeId: territorial ? u.communeId : (school?.communeId ?? null),
    schoolId: territorial ? null : (school?.id ?? null),
    chain: territorial ? (u.scopeLevel === "COMMUNE" ? "PRIMARY" : u.chain) : school ? chainOfCycle(school.cycle) : null,
  } as const;
}

// Records a sign in attempt or a sign out. Never fails the sign in: an
// error is logged without any personal data and the person goes on.
export async function recordConnection(outcome: ConnectionOutcome, options: { userId?: string | null; demo?: boolean; firstTime?: boolean } = {}) {
  try {
    const h = await headers();
    const agent = parseUserAgent(h.get("user-agent"));
    const scope = options.userId ? await snapshot(options.userId) : null;
    await db.connectionEvent.create({
      data: {
        outcome,
        userId: options.userId ?? null,
        ...(scope ?? {}),
        ip: clientIp(h),
        browser: agent.browser,
        os: agent.os,
        device: agent.device,
        demo: !!options.demo,
        firstTime: !!options.firstTime,
      },
    });
  } catch (error) {
    console.error("connection event write failed", error instanceof Error ? error.message : "unknown error");
  }
}

import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/files";

type User = NonNullable<CurrentUser>;

export async function mySignature(user: User) {
  const row = await db.userSignature.findUnique({ where: { userId: user.id }, select: { signatureFileId: true, stampFileId: true, updatedAt: true } });
  return {
    signatureUrl: fileUrl(row?.signatureFileId),
    stampUrl: fileUrl(row?.stampFileId),
    updatedAt: row?.updatedAt ?? null,
  };
}

type Latest = { code: string; at: Date };

// Latest valid signature per subject, for the lists.
async function latestSignatures(kind: string, subjectIds: string[]) {
  if (!subjectIds.length) return new Map<string, Latest>();
  const rows = await db.documentSignature.findMany({
    where: { kind, subjectId: { in: subjectIds }, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { subjectId: true, reference: true, createdAt: true },
  });
  const map = new Map<string, Latest>();
  for (const r of rows) if (!map.has(r.subjectId)) map.set(r.subjectId, { code: r.reference, at: r.createdAt });
  return map;
}

// Pupils of the head's school in the active year, searched by name or
// matricule, with the state of their attestation and certificate.
export async function pupilsToSign(user: User, q: string, take = 15) {
  const schoolId = user.scope.schoolId ?? "__none__";
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 3);
  const rows = await db.enrollment.findMany({
    where: {
      schoolId,
      status: "ACTIVE",
      academicYear: { isActive: true },
      AND: terms.map((t) => ({
        OR: [
          { student: { firstName: { contains: t, mode: "insensitive" as const } } },
          { student: { lastName: { contains: t, mode: "insensitive" as const } } },
          { student: { matricule: { contains: t, mode: "insensitive" as const } } },
        ],
      })),
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    take,
    select: { id: true, student: { select: { id: true, firstName: true, lastName: true, matricule: true } }, classroom: { select: { name: true } } },
  });
  const ids = rows.map((r) => r.id);
  const [att, cert] = await Promise.all([latestSignatures("attestation", ids), latestSignatures("certificat", ids)]);
  return rows.map((r) => ({ ...r, attestation: att.get(r.id) ?? null, certificat: cert.get(r.id) ?? null }));
}

// Published report cards of the school in the active year, per class and
// period, with how many are signed.
export async function reportCardBatches(user: User) {
  const schoolId = user.scope.schoolId ?? "__none__";
  const cards = await db.reportCard.findMany({
    where: { enrollment: { schoolId, academicYear: { isActive: true } } },
    select: { id: true, periodId: true, period: { select: { name: true, startDate: true } }, enrollment: { select: { classroomId: true, classroom: { select: { name: true } } } } },
  });
  const signed = await latestSignatures("bulletin", cards.map((c) => c.id));
  const groups = new Map<string, { classroomId: string; classroom: string; periodId: string; period: string; start: Date; total: number; signed: number }>();
  for (const c of cards) {
    const key = `${c.enrollment.classroomId}:${c.periodId}`;
    const g = groups.get(key) ?? { classroomId: c.enrollment.classroomId, classroom: c.enrollment.classroom.name, periodId: c.periodId, period: c.period.name, start: c.period.startDate, total: 0, signed: 0 };
    g.total++;
    if (signed.has(c.id)) g.signed++;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.start.getTime() - a.start.getTime() || a.classroom.localeCompare(b.classroom, "fr", { numeric: true }));
}

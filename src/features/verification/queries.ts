import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/authorize";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { DOCUMENT_KINDS, initials, REVOKE_PERMISSION, statusOf, type DocumentKind } from "./reference";

type User = NonNullable<CurrentUser>;

const pupil = { firstName: true, lastName: true } as const;

// Initials of the pupil a document is about, found from its subject (an
// enrollment, a report card, a payment or an invoice). Null for documents
// about a class or a territory.
async function pupilInitials(kind: string, subjectId: string | null) {
  if (!subjectId) return null;
  const fromEnrollment = async (id: string) => (await db.enrollment.findUnique({ where: { id }, select: { student: { select: pupil } } }))?.student ?? null;
  let s: { firstName: string; lastName: string } | null = null;
  switch (kind) {
    case "attestation":
    case "certificat":
    case "releve":
      s = await fromEnrollment(subjectId);
      break;
    case "bulletin":
      s = (await db.reportCard.findUnique({ where: { id: subjectId }, select: { enrollment: { select: { student: { select: pupil } } } } }))?.enrollment.student ?? (await fromEnrollment(subjectId));
      break;
    case "recu":
      s = (await db.payment.findFirst({ where: { OR: [{ id: subjectId }, { reference: subjectId }] }, select: { invoice: { select: { enrollment: { select: { student: { select: pupil } } } } } } }))?.invoice.enrollment.student ?? null;
      break;
    case "facture":
      s = (await db.invoice.findFirst({ where: { OR: [{ id: subjectId }, { number: subjectId }] }, select: { enrollment: { select: { student: { select: pupil } } } } }))?.enrollment.student ?? null;
      break;
  }
  return s ? initials(s.firstName, s.lastName) : null;
}

// What the public page shows about a code: never a name in full, a grade,
// an amount or an account. Enough to match the paper in hand.
export async function publicVerification(code: string) {
  const doc = await db.issuedDocument.findUnique({
    where: { reference: code },
    select: { id: true, reference: true, kind: true, title: true, subjectId: true, schoolId: true, contentHash: true, signatureId: true, revokedAt: true, revokedReason: true, createdAt: true },
  });
  if (!doc) return { status: "unknown" as const };
  const [school, signature, pupilInitialsValue] = await Promise.all([
    doc.schoolId ? db.school.findUnique({ where: { id: doc.schoolId }, select: { name: true, commune: { select: { name: true } } } }) : null,
    doc.signatureId
      ? db.documentSignature.findUnique({
          where: { id: doc.signatureId },
          select: { createdAt: true, revokedAt: true, signedBy: { select: { firstName: true, lastName: true, role: { select: { name: true } } } } },
        })
      : null,
    pupilInitials(doc.kind, doc.subjectId),
  ]);
  return {
    status: statusOf(doc, signature),
    id: doc.id,
    code: doc.reference,
    kind: doc.kind,
    kindLabel: DOCUMENT_KINDS[doc.kind as DocumentKind] ?? doc.title,
    title: doc.title,
    issuedAt: doc.createdAt,
    schoolId: doc.schoolId,
    school: school ? `${school.name}, ${school.commune.name}` : null,
    pupil: pupilInitialsValue,
    // The file hash of an unsigned copy: a visitor can compare the file in
    // hand. A signed document seals its content instead, printed afresh.
    fileHash: doc.signatureId ? null : doc.contentHash,
    signed: signature ? { by: `${signature.signedBy.firstName} ${signature.signedBy.lastName}`, role: signature.signedBy.role.name, at: signature.createdAt } : null,
    revokedAt: doc.revokedAt ?? signature?.revokedAt ?? null,
    revokedReason: doc.revokedReason,
  };
}

export type PublicVerification = Awaited<ReturnType<typeof publicVerification>>;

// Whether a signed in staff member may revoke an issued document: the right
// governing its data, on a school of their scope.
export async function canRevoke(user: User | null, doc: { kind: string; schoolId: string | null }) {
  if (!user || user.scope.level === "SELF" || user.mustChangePassword) return false;
  const permission = REVOKE_PERMISSION[doc.kind as DocumentKind];
  if (!permission || !can(user, permission)) return false;
  if (!doc.schoolId) return user.scope.level === "NATIONAL";
  return (await db.school.count({ where: { AND: [{ id: doc.schoolId }, schoolWhere(user)] } })) > 0;
}

// The register of a school, for its staff: last documents issued, filtered
// by code or kind.
export async function listIssued(user: User, f: { q: string; kind?: string; take?: number }) {
  const where: Prisma.IssuedDocumentWhereInput = {
    AND: [
      user.scope.level === "NATIONAL" ? {} : { schoolId: { in: (await db.school.findMany({ where: schoolWhere(user), select: { id: true }, take: 5000 })).map((s) => s.id) } },
      f.kind && f.kind in DOCUMENT_KINDS ? { kind: f.kind } : {},
      f.q ? { reference: { contains: f.q.trim().toUpperCase(), mode: "insensitive" } } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.issuedDocument.findMany({ where, orderBy: { createdAt: "desc" }, take: f.take ?? 50, select: { id: true, reference: true, kind: true, title: true, createdAt: true, revokedAt: true, signatureId: true, schoolId: true, issuedById: true } }),
    db.issuedDocument.count({ where }),
  ]);
  const issuers = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.issuedById))] } }, select: { id: true, firstName: true, lastName: true } });
  const name = new Map(issuers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  return { rows: rows.map((r) => ({ ...r, issuedBy: name.get(r.issuedById) ?? "Compte supprimé" })), total };
}

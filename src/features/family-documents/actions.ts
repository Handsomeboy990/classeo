"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { can, ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { DomainError } from "@/lib/errors";
import { saveUpload } from "@/lib/files";
import { assertSchoolWritable, assertWritable } from "@/lib/guards";
import { guardianUserIds, notify } from "@/lib/notify";
import { hitRateLimit } from "@/lib/rate-limit";
import { formatDate } from "@/lib/utils";

import { staffDocWhere } from "./access";
import { ownEnrollment } from "./queries";
import { canSendAgain, dropsFileOnDecision, isHealthDoc, KIND_LABELS, periodError, refusalToSend, reviewPermission, type FamilyDocKind } from "./rules";

type User = NonNullable<CurrentUser>;

const id = z.string().trim().min(1).max(64);
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => v || null);
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isIsoDate(v), "Date invalide.");
const file = z
  .instanceof(File)
  .optional()
  .transform((f) => (f && f.size > 0 ? f : null));

const UPLOADS_PER_HOUR = 20;

// The staff of the school who examine this kind of piece.
async function reviewers(schoolId: string, health: boolean) {
  const code = reviewPermission({ health });
  const users = await db.user.findMany({
    where: { isActive: true, scopeLevel: "SCHOOL", schoolId, role: { permissions: { some: { permission: { code } } } } },
    select: { id: true },
    take: 200,
  });
  return users.map((u) => u.id);
}

// A parent, or a student of 16 or more, sends a piece for a child of the
// running year: an enrollment piece the school asks for, the justification
// of an absence, or a medical certificate for an EPS dispensation.
// Every id sent by the browser is looked up again through the account's own
// family links; the file is checked from its bytes (PDF or photo, 3 MB).
export const submitFamilyDocument = createAction({
  permission: "family_document:create",
  schema: z
    .object({
      kind: z.enum(["ENROLLMENT", "ABSENCE", "MEDICAL"], "Type de pièce inconnu."),
      studentId: id,
      requiredPieceId: id.optional(),
      attendanceId: id.optional(),
      startsOn: optionalDate,
      endsOn: optionalDate,
      note: optionalText(500, "500 caractères au plus."),
      file,
    })
    .superRefine((v, ctx) => {
      if (v.kind !== "ABSENCE" && !v.file) ctx.addIssue({ code: "custom", path: ["file"], message: "Choisissez le fichier ou prenez la pièce en photo." });
      if (v.kind === "ABSENCE" && !v.file && (!v.note || v.note.length < 5)) ctx.addIssue({ code: "custom", path: ["note"], message: "Expliquez l'absence en quelques mots, ou joignez un justificatif." });
      if (v.kind === "ENROLLMENT" && !v.requiredPieceId) ctx.addIssue({ code: "custom", path: ["requiredPieceId"], message: "Choisissez la pièce." });
      if (v.kind === "ABSENCE" && !v.attendanceId) ctx.addIssue({ code: "custom", path: ["attendanceId"], message: "Choisissez l'absence à justifier." });
      if (v.kind === "MEDICAL") {
        const error = periodError(v.startsOn ?? "", v.endsOn ?? "");
        if (error) ctx.addIssue({ code: "custom", path: [v.startsOn ? "endsOn" : "startsOn"], message: error });
      }
    }),
  handler: async (input, user) => {
    const enrollment = await ownEnrollment(user, input.studentId);
    if (!enrollment) throw new ForbiddenError("Cet enfant n'est pas rattaché à votre compte.");
    const today = todayIso();

    let health = input.kind === "MEDICAL";
    let label: string = KIND_LABELS[input.kind];
    let link: { requiredPieceId?: string; attendanceId?: string } = {};
    let previous: { status: "PENDING" | "ACCEPTED" | "REJECTED" }[] = [];

    if (input.kind === "ENROLLMENT") {
      const piece = await db.requiredPiece.findFirst({
        where: { id: input.requiredPieceId, schoolId: enrollment.schoolId, archivedAt: null, OR: [{ levelId: null }, { levelId: enrollment.classroom.levelId }] },
        select: { id: true, label: true, isHealth: true },
      });
      if (!piece) throw new DomainError("Cette pièce n'est pas demandée par l'école de cet enfant.");
      health = piece.isHealth;
      label = piece.label;
      link = { requiredPieceId: piece.id };
      previous = await db.familyDocument.findMany({ where: { enrollmentId: enrollment.id, requiredPieceId: piece.id }, select: { status: true } });
    } else if (input.kind === "ABSENCE") {
      const absence = await db.studentAttendance.findFirst({ where: { id: input.attendanceId, enrollmentId: enrollment.id, status: "ABSENT" }, select: { id: true, date: true, half: true } });
      if (!absence) throw new DomainError("Cette absence est introuvable ou déjà justifiée.");
      label = `Absence du ${formatDate(absence.date)} ${absence.half === "MORNING" ? "matin" : "après-midi"}`;
      link = { attendanceId: absence.id };
      previous = await db.familyDocument.findMany({ where: { attendanceId: absence.id }, select: { status: true } });
    }

    const refusal = refusalToSend(user, { health }, enrollment.student, isoToDate(today));
    if (refusal) throw new ForbiddenError(refusal);
    if (!canSendAgain(previous)) throw new DomainError("Une pièce est déjà envoyée pour cela : attendez la réponse de l'école.");
    await assertWritable({ schoolId: enrollment.schoolId, academicYearId: enrollment.academicYearId });
    const limit = await hitRateLimit(`family-doc:${user.id}`, UPLOADS_PER_HOUR, 3_600_000);
    if (!limit.allowed) throw new DomainError("Beaucoup d'envois en une heure. Réessayez un peu plus tard.");

    const fileId = input.file ? await saveUpload(user, "family_document", input.file) : null;
    const doc = await db.familyDocument.create({
      data: {
        kind: input.kind,
        studentId: enrollment.student.id,
        enrollmentId: enrollment.id,
        schoolId: enrollment.schoolId,
        ...link,
        startsOn: input.kind === "MEDICAL" ? isoToDate(input.startsOn!) : null,
        endsOn: input.kind === "MEDICAL" ? isoToDate(input.endsOn!) : null,
        // No free text is kept with a medical certificate: a family could
        // write the illness there.
        note: input.kind === "MEDICAL" ? null : input.note,
        fileId,
        submittedById: user.id,
      },
      select: { id: true },
    });
    const child = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    await audit(user, { action: "create", resource: "family_document", resourceId: doc.id, schoolId: enrollment.schoolId, summary: `${label} envoyée pour ${child}` });
    await notify(await reviewers(enrollment.schoolId, health), {
      kind: "family_document",
      title: `${KIND_LABELS[input.kind]} à examiner`,
      body: `${child}, ${enrollment.classroom.name} : ${label}.`,
      link: `/espace/pieces-familles/${doc.id}`,
    });
    return input.kind === "ABSENCE" ? "Justification envoyée. L'école vous répondra ici." : "Pièce envoyée. L'école vous répondra ici.";
  },
});

// The school accepts or refuses a piece. An accepted justification marks the
// absence excused. A health piece loses its file at the decision, whatever
// it is: only the decision, the period and the date remain.
export const reviewFamilyDocument = createAction({
  // Checked below against the kind of piece: family_document:approve, or
  // health_document:approve for a health piece.
  permission: null,
  schema: z
    .object({
      documentId: id,
      decision: z.enum(["ACCEPTED", "REJECTED"], "Choisissez une décision."),
      note: optionalText(500, "500 caractères au plus."),
    })
    .superRefine((v, ctx) => {
      if (v.decision === "REJECTED" && (!v.note || v.note.length < 5)) ctx.addIssue({ code: "custom", path: ["note"], message: "Dites à la famille ce qui ne va pas (5 caractères au moins)." });
    }),
  handler: async ({ documentId, decision, note }, user) => {
    const doc = await db.familyDocument.findFirst({
      where: { AND: [{ id: documentId }, staffDocWhere(user)] },
      select: {
        id: true,
        kind: true,
        status: true,
        schoolId: true,
        enrollmentId: true,
        attendanceId: true,
        fileId: true,
        note: true,
        submittedById: true,
        startsOn: true,
        endsOn: true,
        requiredPiece: { select: { label: true, isHealth: true } },
        enrollment: { select: { academicYearId: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!doc) throw new DomainError("Pièce introuvable pour votre établissement.");
    const health = isHealthDoc(doc);
    if (!can(user, reviewPermission({ health }))) throw new ForbiddenError();
    if (doc.status !== "PENDING") throw new DomainError("Cette pièce a déjà reçu une réponse.");
    await assertWritable({ schoolId: doc.schoolId, academicYearId: doc.enrollment.academicYearId });

    const now = new Date();
    const accepted = decision === "ACCEPTED";
    const dropFile = dropsFileOnDecision({ health }) && !!doc.fileId;
    await db.$transaction(async (tx) => {
      const { count } = await tx.familyDocument.updateMany({
        where: { id: doc.id, status: "PENDING" },
        data: { status: decision, reviewedById: user.id, reviewedAt: now, reviewNote: note, ...(dropFile ? { fileId: null, fileRemovedAt: now } : {}) },
      });
      if (!count) throw new DomainError("Cette pièce vient de recevoir une réponse d'un collègue.");
      if (accepted && doc.kind === "ABSENCE" && doc.attendanceId) {
        await tx.studentAttendance.updateMany({
          where: { id: doc.attendanceId, status: "ABSENT" },
          data: { status: "EXCUSED", reason: (doc.note ? `Justifiée : ${doc.note}` : "Justifiée par la famille").slice(0, 200) },
        });
      }
      if (dropFile) await tx.fileBlob.delete({ where: { id: doc.fileId! } });
    });

    const child = `${doc.student.firstName} ${doc.student.lastName}`;
    const what = doc.kind === "ENROLLMENT" ? (doc.requiredPiece?.label ?? KIND_LABELS.ENROLLMENT) : KIND_LABELS[doc.kind as FamilyDocKind];
    await audit(user, {
      action: "approve",
      resource: "family_document",
      resourceId: doc.id,
      schoolId: doc.schoolId,
      summary: `${what} de ${child} ${accepted ? "validée" : "refusée"}${dropFile ? ", fichier supprimé" : ""}`,
      metadata: { decision, kind: doc.kind, fileDeleted: dropFile },
    });
    const family = [...(await guardianUserIds([doc.enrollmentId])), doc.submittedById];
    // One date, last: the translation layer writes a date that ends a sentence.
    const period = doc.kind === "MEDICAL" && doc.endsOn ? ` Dispense d'EPS jusqu'au ${formatDate(doc.endsOn)}` : "";
    await notify(family, {
      kind: "family_document",
      // Short sentences with the name and the dates apart, so the translation
      // layer finds each one (names and dates are template values).
      title: accepted ? `Pièce validée : ${what}` : `Pièce refusée : ${what}`,
      body: accepted ? `Pour ${child}.${period}` : `Pour ${child}. Motif : ${note}`,
      link: `/espace/pieces-justificatifs?enfant=${doc.student.id}`,
    });
    if (accepted) return doc.kind === "ABSENCE" ? "Justification acceptée : l'absence est excusée." : dropFile ? "Pièce validée. Le fichier de santé est supprimé, seule la décision est gardée." : "Pièce validée.";
    return dropFile ? "Pièce refusée, la famille est prévenue. Le fichier de santé est supprimé." : "Pièce refusée, la famille est prévenue.";
  },
});

// ---------------------------------------------------------------------------
// The list of pieces the school asks for
// ---------------------------------------------------------------------------

function ownSchool(user: User) {
  if (user.scope.level !== "SCHOOL" || !user.scope.schoolId) throw new ForbiddenError("Seul un établissement tient sa liste de pièces.");
  return user.scope.schoolId;
}

export const addRequiredPiece = createAction({
  permission: "family_document:approve",
  schema: z.object({
    label: z.string().trim().min(3, "Nommez la pièce (3 caractères au moins).").max(120, "120 caractères au plus."),
    description: optionalText(300, "300 caractères au plus."),
    levelId: z
      .string()
      .max(64)
      .optional()
      .transform((v) => v || null),
    isHealth: z
      .enum(["on"])
      .optional()
      .transform((v) => v === "on"),
  }),
  handler: async (input, user) => {
    const schoolId = ownSchool(user);
    await assertSchoolWritable(schoolId);
    if (input.levelId && !(await db.academicLevel.count({ where: { id: input.levelId } }))) throw new DomainError("Niveau inconnu.");
    const count = await db.requiredPiece.count({ where: { schoolId, archivedAt: null } });
    if (count >= 30) throw new DomainError("30 pièces au plus dans la liste.");
    const piece = await db.requiredPiece.create({ data: { schoolId, label: input.label, description: input.description, levelId: input.levelId, isHealth: input.isHealth, sortOrder: count }, select: { id: true } });
    await audit(user, { action: "create", resource: "required_piece", resourceId: piece.id, schoolId, summary: `Pièce ajoutée à la liste demandée aux familles : ${input.label}` });
    return "Pièce ajoutée à la liste.";
  },
});

export const archiveRequiredPiece = createAction({
  permission: "family_document:approve",
  schema: z.object({ pieceId: id }),
  handler: async ({ pieceId }, user) => {
    const schoolId = ownSchool(user);
    await assertSchoolWritable(schoolId);
    const piece = await db.requiredPiece.findFirst({ where: { id: pieceId, schoolId, archivedAt: null }, select: { id: true, label: true } });
    if (!piece) throw new DomainError("Pièce introuvable dans votre liste.");
    // Withdrawn, not deleted: the pieces families already sent keep their name.
    await db.requiredPiece.update({ where: { id: piece.id }, data: { archivedAt: new Date() } });
    await audit(user, { action: "delete", resource: "required_piece", resourceId: piece.id, schoolId, summary: `Pièce retirée de la liste demandée aux familles : ${piece.label}` });
    return "Pièce retirée de la liste.";
  },
});

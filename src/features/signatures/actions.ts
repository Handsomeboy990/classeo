"use server";

import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ForbiddenError } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { saveUpload } from "@/lib/files";
import { assertWritable } from "@/lib/guards";
import { guardianUserIds, notify } from "@/lib/notify";

import { DOCUMENT_KINDS, SIGNABLE_KINDS, contentHash, newVerificationCode, type SignableKind } from "@/features/verification/reference";

import { canSignSchoolDocuments, signerKind } from "./access";
import { signableContent } from "./content";

type User = NonNullable<CurrentUser>;

function requireSigner(user: User) {
  if (!signerKind(user)) throw new ForbiddenError("Seuls les chefs d'établissement et les autorités territoriales enregistrent une signature.");
}

const image = z.instanceof(File, { message: "Choisissez une image." }).refine((f) => f.size > 0, "Choisissez une image.");

// Replaces one image (signature or stamp) of the signer. The previous file
// is deleted: only the current one is ever applied to documents.
async function replaceImage(user: User, purpose: "signature" | "stamp", fileId: string) {
  const field = purpose === "signature" ? "signatureFileId" : "stampFileId";
  const before = await db.userSignature.findUnique({ where: { userId: user.id }, select: { signatureFileId: true, stampFileId: true } });
  await db.userSignature.upsert({ where: { userId: user.id }, create: { userId: user.id, [field]: fileId }, update: { [field]: fileId } });
  const old = before?.[field];
  if (old && old !== fileId) await db.fileBlob.deleteMany({ where: { id: old, ownerUserId: user.id } });
  await audit(user, {
    action: "update",
    resource: "signature",
    resourceId: user.id,
    summary: purpose === "signature" ? "Signature électronique enregistrée" : "Cachet enregistré",
    schoolId: user.scope.schoolId,
  });
}

export const uploadSignatureImage = createAction({
  permission: null,
  schema: z.object({ purpose: z.enum(["signature", "stamp"]), file: image }),
  handler: async (input, user) => {
    requireSigner(user);
    const id = await saveUpload(user, input.purpose, input.file);
    await replaceImage(user, input.purpose, id);
    return input.purpose === "signature" ? "Signature enregistrée." : "Cachet enregistré.";
  },
});

const PNG_DATA_URL = "data:image/png;base64,";

// A signature drawn on the pad, sent as a PNG data address. It goes through
// the same content checks as an uploaded file.
export const saveDrawnSignature = createAction({
  permission: null,
  schema: z.object({
    drawing: z
      .string({ error: "Tracez votre signature." })
      .startsWith(PNG_DATA_URL, "Tracez votre signature.")
      .max(700_000, "Signature trop lourde : effacez et tracez-la à nouveau."),
  }),
  handler: async (input, user) => {
    requireSigner(user);
    const bytes = Buffer.from(input.drawing.slice(PNG_DATA_URL.length), "base64");
    if (bytes.length < 200) throw new DomainError("La signature est vide : tracez-la dans le cadre.");
    const id = await saveUpload(user, "signature", new File([new Uint8Array(bytes)], "signature-tracee.png", { type: "image/png" }));
    await replaceImage(user, "signature", id);
    return "Signature enregistrée.";
  },
});

export const removeSignatureImage = createAction({
  permission: null,
  schema: z.object({ purpose: z.enum(["signature", "stamp"]) }),
  handler: async (input, user) => {
    const row = await db.userSignature.findUnique({ where: { userId: user.id } });
    const field = input.purpose === "signature" ? "signatureFileId" : "stampFileId";
    const id = row?.[field];
    if (!id) throw new DomainError("Rien à retirer.");
    await db.userSignature.update({ where: { userId: user.id }, data: { [field]: null } });
    await db.fileBlob.deleteMany({ where: { id, ownerUserId: user.id } });
    await audit(user, { action: "delete", resource: "signature", resourceId: user.id, summary: input.purpose === "signature" ? "Signature électronique retirée" : "Cachet retiré", schoolId: user.scope.schoolId });
    return input.purpose === "signature" ? "Signature retirée." : "Cachet retiré.";
  },
});

// The subject of a school document, inside the head's own school.
async function subjectInSchool(kind: SignableKind, subjectId: string, schoolId: string) {
  if (kind === "bulletin") {
    const c = await db.reportCard.findFirst({
      where: { id: subjectId, enrollment: { schoolId } },
      select: { enrollment: { select: { id: true, academicYearId: true, student: { select: { firstName: true, lastName: true } } } }, period: { select: { name: true } } },
    });
    return c ? { enrollmentId: c.enrollment.id, academicYearId: c.enrollment.academicYearId, student: c.enrollment.student, label: c.period.name } : null;
  }
  const e = await db.enrollment.findFirst({
    where: { id: subjectId, schoolId, status: "ACTIVE" },
    select: { id: true, academicYearId: true, student: { select: { firstName: true, lastName: true } }, academicYear: { select: { label: true } } },
  });
  return e ? { enrollmentId: e.id, academicYearId: e.academicYearId, student: e.student, label: e.academicYear.label } : null;
}

// Signs one document: the content is read and hashed on the server, a
// signature and its register entry share one verification code. A copy
// signed earlier for another content (a corrected grade) is superseded.
async function signOne(user: User, kind: SignableKind, subjectId: string) {
  const schoolId = user.scope.schoolId!;
  const subject = await subjectInSchool(kind, subjectId, schoolId);
  if (!subject) throw new DomainError("Document introuvable dans votre établissement.");
  const content = await signableContent(kind, subjectId);
  if (!content) throw new DomainError("Ce document ne peut pas être signé : l'inscription n'est pas active.");
  const hash = contentHash(content);

  const current = await db.documentSignature.findFirst({ where: { kind, subjectId, contentHash: hash, revokedAt: null }, select: { reference: true } });
  if (current) return { code: current.reference, subject, created: false };

  const now = new Date();
  const title = DOCUMENT_KINDS[kind];
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newVerificationCode();
    try {
      await db.$transaction(async (tx) => {
        const older = await tx.documentSignature.findMany({ where: { kind, subjectId, revokedAt: null }, select: { id: true } });
        if (older.length) {
          const ids = older.map((o) => o.id);
          await tx.documentSignature.updateMany({ where: { id: { in: ids } }, data: { revokedAt: now } });
          await tx.issuedDocument.updateMany({ where: { signatureId: { in: ids }, revokedAt: null }, data: { revokedAt: now, revokedReason: "Remplacé par une nouvelle version signée." } });
        }
        const sig = await tx.documentSignature.create({ data: { reference: code, kind, subjectId, contentHash: hash, signedById: user.id, schoolId } });
        await tx.issuedDocument.create({ data: { reference: code, kind, title, subjectId, schoolId, contentHash: hash, issuedById: user.id, signatureId: sig.id } });
      });
      return { code, subject, created: true };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("could not draw a free verification code");
}

async function assertReadyToSign(user: User) {
  if (!canSignSchoolDocuments(user)) throw new ForbiddenError("Seul le chef d'établissement signe les documents de l'établissement.");
  const mine = await db.userSignature.findUnique({ where: { userId: user.id }, select: { signatureFileId: true } });
  if (!mine?.signatureFileId) throw new DomainError("Enregistrez d'abord votre signature (page Signature électronique).");
}

export const signDocument = createAction({
  permission: null,
  schema: z.object({ kind: z.enum(SIGNABLE_KINDS), subjectId: z.string().trim().min(1).max(40) }),
  handler: async (input, user) => {
    await assertReadyToSign(user);
    const schoolId = user.scope.schoolId!;
    const probe = await subjectInSchool(input.kind, input.subjectId, schoolId);
    if (!probe) throw new DomainError("Document introuvable dans votre établissement.");
    await assertWritable({ schoolId, academicYearId: probe.academicYearId });
    const { code, subject, created } = await signOne(user, input.kind, input.subjectId);
    const who = `${subject.student.lastName} ${subject.student.firstName}`;
    if (!created) return `Ce document est déjà signé (code ${code}).`;
    await audit(user, {
      action: "sign",
      resource: "document",
      resourceId: input.subjectId,
      summary: `${DOCUMENT_KINDS[input.kind]} de ${who} (${subject.label}) signé électroniquement, code ${code}`,
      metadata: { kind: input.kind, code },
      schoolId,
    });
    if (input.kind !== "bulletin") {
      await notify(await guardianUserIds([subject.enrollmentId]), {
        kind: "document_signed",
        title: `${DOCUMENT_KINDS[input.kind]} signé`,
        body: `${DOCUMENT_KINDS[input.kind]} de ${subject.student.firstName} (${subject.label}) est signé électroniquement. Vous pouvez le télécharger ; son authenticité se vérifie avec le code ${code}.`,
        link: `/espace/suivi`,
      });
    }
    return `${DOCUMENT_KINDS[input.kind]} de ${who} signé. Code de vérification : ${code}.`;
  },
});

// Signs every published report card of a class for a period.
export const signClassReportCards = createAction({
  permission: null,
  schema: z.object({ classroomId: z.string().trim().min(1).max(40), periodId: z.string().trim().min(1).max(40) }),
  handler: async (input, user) => {
    await assertReadyToSign(user);
    const schoolId = user.scope.schoolId!;
    const classroom = await db.classroom.findFirst({ where: { id: input.classroomId, schoolId }, select: { id: true, name: true, academicYearId: true } });
    if (!classroom) throw new DomainError("Classe introuvable dans votre établissement.");
    await assertWritable({ schoolId, academicYearId: classroom.academicYearId });
    const cards = await db.reportCard.findMany({ where: { periodId: input.periodId, enrollment: { classroomId: classroom.id, schoolId } }, select: { id: true } });
    if (!cards.length) throw new DomainError("Aucun bulletin publié pour cette classe et cette période.");
    let signed = 0;
    for (const c of cards) if ((await signOne(user, "bulletin", c.id)).created) signed++;
    const period = await db.schoolPeriod.findUnique({ where: { id: input.periodId }, select: { name: true } });
    await audit(user, {
      action: "sign",
      resource: "document",
      resourceId: classroom.id,
      summary: `${signed} bulletin${signed > 1 ? "s" : ""} de la ${classroom.name} (${period?.name ?? ""}) signé${signed > 1 ? "s" : ""} électroniquement`,
      metadata: { kind: "bulletin", classroomId: classroom.id, periodId: input.periodId, signed },
      schoolId,
    });
    return signed ? `${signed} bulletin${signed > 1 ? "s" : ""} signé${signed > 1 ? "s" : ""}.` : "Tous les bulletins publiés étaient déjà signés.";
  },
});

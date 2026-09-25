"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, optionalText, requireActiveYear, requiredText } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { enrollmentWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { isEnabled } from "@/lib/features";
import { assertWritable } from "@/lib/guards";
import { notify } from "@/lib/notify";

import { moveEnrollment } from "./enrollment-move";
import { nextStatus, type TransferEvent } from "./logic";

type User = NonNullable<CurrentUser>;

async function assertModuleOn() {
  if (!(await isEnabled("students.transfers"))) throw new DomainError("Les transferts d'élèves sont désactivés pour le moment.");
}

function assertTransition(kind: "CLASS_CHANGE" | "SCHOOL_CHANGE", status: Parameters<typeof nextStatus>[1], event: TransferEvent) {
  const next = nextStatus(kind, status, event);
  if (!next.ok) throw new DomainError(next.message);
  return next.status;
}

// The pupil's active enrollment of the year in the user's school.
async function activeEnrollment(user: User, studentId: string) {
  const year = await requireActiveYear();
  const enrollment = await db.enrollment.findFirst({
    where: { AND: [{ studentId, academicYearId: year.id, status: "ACTIVE" }, enrollmentWhere(user)] },
    select: {
      id: true,
      schoolId: true,
      classroomId: true,
      academicYearId: true,
      classroom: { select: { name: true } },
      school: { select: { name: true } },
      student: { select: { id: true, firstName: true, lastName: true, userId: true } },
    },
  });
  if (!enrollment) throw new DomainError("Élève introuvable, déjà parti ou hors de votre périmètre.");
  if (user.scope.level !== "SCHOOL" || enrollment.schoolId !== user.scope.schoolId) throw new DomainError("Seul l'établissement de l'élève peut demander son transfert.");
  return { year, enrollment };
}

async function classroomWithRoom(schoolId: string, classroomId: string, academicYearId: string) {
  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, schoolId, academicYearId },
    select: { id: true, name: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  if (!classroom) throw new DomainError("Classe introuvable dans cet établissement pour l'année en cours.");
  if (classroom._count.enrollments >= classroom.capacity) throw new DomainError(`La ${classroom.name} est complète (${classroom.capacity} places).`);
  return classroom;
}

// Accounts to tell about a pupil: guardians with an account, and the pupil.
async function familyAccounts(studentId: string) {
  const [links, student] = await Promise.all([
    db.studentGuardian.findMany({ where: { studentId, guardian: { userId: { not: null } } }, select: { guardian: { select: { userId: true } } } }),
    db.student.findUnique({ where: { id: studentId }, select: { userId: true } }),
  ]);
  return [...links.map((l) => l.guardian.userId!), ...(student?.userId ? [student.userId] : [])];
}

async function primaryGuardian(studentId: string) {
  const link = await db.studentGuardian.findFirst({
    where: { studentId, isPrimary: true },
    select: { guardian: { select: { id: true, userId: true, firstName: true, lastName: true } } },
  });
  return link?.guardian ?? null;
}

// Staff of a school who can enroll a pupil: they decide on incoming
// transfers.
async function admissionStaff(schoolId: string) {
  const users = await db.user.findMany({
    where: { schoolId, isActive: true, scopeLevel: "SCHOOL", role: { permissions: { some: { permission: { code: "student:create" } } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

const link = (transferId: string) => `/espace/transferts/${transferId}`;

// ---------------------------------------------------------------------------
// Class change inside the school: immediate.
// ---------------------------------------------------------------------------

export const changeClass = createAction({
  permission: "student:update",
  schema: z.object({ studentId: id, toClassroomId: id, reason: requiredText(300) }),
  handler: async (input, user) => {
    await assertModuleOn();
    const { year, enrollment } = await activeEnrollment(user, input.studentId);
    await assertWritable({ schoolId: enrollment.schoolId, academicYearId: year.id });
    if (input.toClassroomId === enrollment.classroomId) throw new DomainError("L'élève est déjà dans cette classe.");
    const classroom = await classroomWithRoom(enrollment.schoolId, input.toClassroomId, year.id);
    const now = new Date();
    const transfer = await db.$transaction(async (tx) => {
      await moveEnrollment(tx, enrollment.id, { schoolId: enrollment.schoolId, classroomId: classroom.id });
      return tx.studentTransfer.create({
        data: {
          studentId: enrollment.student.id,
          kind: "CLASS_CHANGE",
          fromSchoolId: enrollment.schoolId,
          fromClassroomId: enrollment.classroomId,
          toSchoolId: enrollment.schoolId,
          toClassroomId: classroom.id,
          reason: input.reason,
          shareHistory: true,
          status: "ACCEPTED",
          requestedById: user.id,
          decidedById: user.id,
          decidedAt: now,
        },
        select: { id: true },
      });
    });
    const name = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    await audit(user, {
      action: "update",
      resource: "student",
      resourceId: enrollment.student.id,
      summary: `Changement de classe de ${name} : ${enrollment.classroom.name} vers ${classroom.name}`,
      metadata: { transferId: transfer.id, reason: input.reason },
      schoolId: enrollment.schoolId,
    });
    await notify(await familyAccounts(enrollment.student.id), {
      kind: "transfer",
      title: `${enrollment.student.firstName} change de classe`,
      body: `${name} passe de la ${enrollment.classroom.name} à la ${classroom.name}, ${enrollment.school.name}.`,
      link: link(transfer.id),
    });
    invalidate(tags.stats);
    redirect(link(transfer.id));
  },
});

// ---------------------------------------------------------------------------
// School change: the origin asks, the guardian consents, the destination
// accepts.
// ---------------------------------------------------------------------------

export const requestSchoolChange = createAction({
  permission: "student:update",
  schema: z.object({
    studentId: id,
    toSchoolId: z.string({ error: "Choisissez l'établissement d'accueil." }).trim().min(1, "Choisissez l'établissement d'accueil.").max(64),
    reason: requiredText(300),
    shareHistory: z.enum(["yes", "no"], { error: "Indiquez si le dossier scolaire suit l'élève." }),
    paperConsent: checkbox,
  }),
  handler: async (input, user) => {
    await assertModuleOn();
    const { year, enrollment } = await activeEnrollment(user, input.studentId);
    await assertWritable({ schoolId: enrollment.schoolId, academicYearId: year.id });
    if (input.toSchoolId === enrollment.schoolId) throw new DomainError("Pour rester dans l'établissement, choisissez un changement de classe.");
    const toSchool = await db.school.findFirst({ where: { id: input.toSchoolId, status: "ACTIVE", isActive: true }, select: { id: true, name: true } });
    if (!toSchool) throw new DomainError("Établissement d'accueil introuvable ou fermé.");
    const pending = await db.studentTransfer.count({ where: { studentId: enrollment.student.id, status: { in: ["PENDING_GUARDIAN", "PENDING_DESTINATION"] } } });
    if (pending) throw new DomainError("Un transfert est déjà en cours pour cet élève.");

    const guardian = await primaryGuardian(enrollment.student.id);
    // A parent without an account (no smartphone, reads little) signs on
    // paper at the school; the school records that consent itself.
    const byPaper = !guardian?.userId;
    if (byPaper && !input.paperConsent) {
      throw new DomainError("Le parent principal n'a pas de compte Classéo : recueillez son accord signé, puis cochez la case prévue.");
    }
    const now = new Date();
    const transfer = await db.studentTransfer.create({
      data: {
        studentId: enrollment.student.id,
        kind: "SCHOOL_CHANGE",
        fromSchoolId: enrollment.schoolId,
        fromClassroomId: enrollment.classroomId,
        toSchoolId: toSchool.id,
        reason: input.reason,
        shareHistory: input.shareHistory === "yes",
        status: byPaper ? "PENDING_DESTINATION" : "PENDING_GUARDIAN",
        requestedById: user.id,
        ...(byPaper ? { guardianDecisionById: user.id, guardianDecidedAt: now } : {}),
      },
      select: { id: true },
    });
    const name = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    await audit(user, {
      action: "create",
      resource: "transfer",
      resourceId: transfer.id,
      summary: `Demande de transfert de ${name} vers ${toSchool.name}${byPaper ? ", accord du parent recueilli sur papier" : ""}`,
      metadata: { studentId: enrollment.student.id, toSchoolId: toSchool.id, shareHistory: input.shareHistory === "yes" },
      schoolId: enrollment.schoolId,
    });
    if (byPaper) {
      await notify(await admissionStaff(toSchool.id), {
        kind: "transfer",
        title: `Demande d'accueil : ${name}`,
        body: `${enrollment.school.name} demande l'accueil de ${name} (${enrollment.classroom.name}). Choisissez sa classe ou refusez.`,
        link: link(transfer.id),
      });
    } else {
      await notify([guardian!.userId!], {
        kind: "transfer",
        title: `Transfert de ${enrollment.student.firstName} : votre accord est demandé`,
        body: `${enrollment.school.name} propose le transfert de ${name} vers ${toSchool.name}. Motif : ${input.reason}. Répondez oui ou non.`,
        link: link(transfer.id),
      });
    }
    redirect(link(transfer.id));
  },
});

export const decideAsGuardian = createAction({
  permission: "student:view",
  schema: z.object({ transferId: id, decision: z.enum(["approve", "refuse"]), note: optionalText(300) }),
  handler: async (input, user) => {
    await assertModuleOn();
    if (!user.guardianId) throw new DomainError("Seul le parent principal de l'élève peut répondre.");
    const t = await db.studentTransfer.findFirst({
      where: { id: input.transferId, student: { guardians: { some: { guardianId: user.guardianId, isPrimary: true } } } },
      select: { id: true, kind: true, status: true, requestedById: true, fromSchoolId: true, toSchoolId: true, student: { select: { id: true, firstName: true, lastName: true } }, toSchool: { select: { name: true } }, fromSchool: { select: { name: true } } },
    });
    if (!t) throw new DomainError("Transfert introuvable, ou vous n'êtes pas le parent principal de cet élève.");
    const status = assertTransition(t.kind, t.status, input.decision === "approve" ? "guardian_approve" : "guardian_refuse");
    const now = new Date();
    const done = await db.studentTransfer.updateMany({
      where: { id: t.id, status: t.status },
      data: { status, guardianDecisionById: user.id, guardianDecidedAt: now, ...(input.decision === "refuse" ? { decisionNote: input.note } : {}) },
    });
    if (!done.count) throw new DomainError("Ce transfert vient d'être modifié. Rechargez la page.");
    const name = `${t.student.firstName} ${t.student.lastName}`;
    await audit(user, {
      action: input.decision === "approve" ? "approve" : "reject",
      resource: "transfer",
      resourceId: t.id,
      summary: `${input.decision === "approve" ? "Accord" : "Refus"} du parent pour le transfert de ${name} vers ${t.toSchool.name}`,
      schoolId: t.fromSchoolId,
    });
    await notify([t.requestedById], {
      kind: "transfer",
      title: input.decision === "approve" ? `Transfert de ${name} : le parent est d'accord` : `Transfert de ${name} : le parent refuse`,
      body: input.decision === "approve" ? `La demande part vers ${t.toSchool.name}, qui doit accepter et choisir la classe.` : `Le parent a refusé le transfert vers ${t.toSchool.name}.${input.note ? ` Motif : ${input.note}` : ""}`,
      link: link(t.id),
    });
    if (input.decision === "approve") {
      await notify(await admissionStaff(t.toSchoolId), {
        kind: "transfer",
        title: `Demande d'accueil : ${name}`,
        body: `${t.fromSchool.name} demande l'accueil de ${name}, avec l'accord du parent. Choisissez sa classe ou refusez.`,
        link: link(t.id),
      });
    }
    return input.decision === "approve" ? "Merci. Votre accord est transmis à l'école d'accueil." : "Votre refus est enregistré. L'élève reste dans son école.";
  },
});

export const decideAsDestination = createAction({
  permission: "student:create",
  schema: z
    .object({ transferId: id, decision: z.enum(["accept", "refuse"]), toClassroomId: z.string().trim().max(64).optional(), note: optionalText(300) })
    .superRefine((v, ctx) => {
      if (v.decision === "accept" && !v.toClassroomId) ctx.addIssue({ code: "custom", path: ["toClassroomId"], message: "Choisissez la classe d'accueil." });
      if (v.decision === "refuse" && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Expliquez le refus au parent et à l'école d'origine." });
    }),
  handler: async (input, user) => {
    await assertModuleOn();
    const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
    const t = schoolId
      ? await db.studentTransfer.findFirst({
          where: { id: input.transferId, toSchoolId: schoolId, kind: "SCHOOL_CHANGE" },
          select: {
            id: true,
            kind: true,
            status: true,
            shareHistory: true,
            requestedById: true,
            fromSchoolId: true,
            fromClassroomId: true,
            toSchoolId: true,
            student: { select: { id: true, firstName: true, lastName: true } },
            toSchool: { select: { name: true } },
            fromSchool: { select: { name: true } },
          },
        })
      : null;
    if (!t) throw new DomainError("Transfert introuvable ou adressé à un autre établissement.");
    const year = await requireActiveYear();
    await assertWritable({ schoolId: t.toSchoolId, academicYearId: year.id });
    const status = assertTransition(t.kind, t.status, input.decision === "accept" ? "destination_accept" : "destination_refuse");
    const name = `${t.student.firstName} ${t.student.lastName}`;
    const now = new Date();

    if (input.decision === "refuse") {
      const done = await db.studentTransfer.updateMany({ where: { id: t.id, status: t.status }, data: { status, decidedById: user.id, decidedAt: now, decisionNote: input.note } });
      if (!done.count) throw new DomainError("Ce transfert vient d'être modifié. Rechargez la page.");
      await audit(user, { action: "reject", resource: "transfer", resourceId: t.id, summary: `Refus d'accueil de ${name} venant de ${t.fromSchool.name}`, schoolId: t.toSchoolId });
      await notify([t.requestedById, ...(await familyAccounts(t.student.id))], {
        kind: "transfer",
        title: `Transfert de ${t.student.firstName} refusé`,
        body: `${t.toSchool.name} ne peut pas accueillir ${name}. Motif : ${input.note}. L'élève reste inscrit à ${t.fromSchool.name}.`,
        link: link(t.id),
      });
      return "Refus enregistré. L'école d'origine et la famille sont prévenues.";
    }

    const classroom = await classroomWithRoom(t.toSchoolId, input.toClassroomId!, year.id);
    const enrollment = await db.enrollment.findFirst({
      where: { studentId: t.student.id, academicYearId: year.id, schoolId: t.fromSchoolId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) throw new DomainError("L'élève n'est plus inscrit dans son école d'origine cette année : le transfert ne peut pas être accepté.");

    await db.$transaction(async (tx) => {
      const done = await tx.studentTransfer.updateMany({
        where: { id: t.id, status: t.status },
        data: { status, toClassroomId: classroom.id, decidedById: user.id, decidedAt: now, decisionNote: input.note },
      });
      if (!done.count) throw new DomainError("Ce transfert vient d'être modifié. Rechargez la page.");
      await moveEnrollment(tx, enrollment.id, { schoolId: t.toSchoolId, classroomId: classroom.id, enrolledAt: now });
      if (t.shareHistory) {
        await tx.studentRecordAccess.upsert({
          where: { studentId_schoolId: { studentId: t.student.id, schoolId: t.toSchoolId } },
          create: { studentId: t.student.id, schoolId: t.toSchoolId, grantedById: user.id },
          update: { expiresAt: null, grantedById: user.id },
        });
      }
    });
    await audit(user, {
      action: "approve",
      resource: "transfer",
      resourceId: t.id,
      summary: `Accueil de ${name} en ${classroom.name}, venant de ${t.fromSchool.name}${t.shareHistory ? ", dossier scolaire partagé" : ""}`,
      schoolId: t.toSchoolId,
    });
    await notify([t.requestedById, ...(await familyAccounts(t.student.id))], {
      kind: "transfer",
      title: `Transfert de ${t.student.firstName} accepté`,
      body: `${name} est accueilli(e) à ${t.toSchool.name}, en ${classroom.name}. Le certificat de scolarité est disponible dans Classéo.`,
      link: link(t.id),
    });
    invalidate(tags.stats);
    return `${name} est inscrit(e) en ${classroom.name}.`;
  },
});

export const cancelTransfer = createAction({
  permission: "student:update",
  schema: z.object({ transferId: id, note: optionalText(300) }),
  handler: async (input, user) => {
    await assertModuleOn();
    const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
    const t = schoolId
      ? await db.studentTransfer.findFirst({
          where: { id: input.transferId, fromSchoolId: schoolId },
          select: { id: true, kind: true, status: true, toSchoolId: true, fromSchoolId: true, student: { select: { id: true, firstName: true, lastName: true } }, toSchool: { select: { name: true } } },
        })
      : null;
    if (!t) throw new DomainError("Transfert introuvable ou demandé par un autre établissement.");
    const status = assertTransition(t.kind, t.status, "cancel");
    const done = await db.studentTransfer.updateMany({ where: { id: t.id, status: t.status }, data: { status, decidedById: user.id, decidedAt: new Date(), decisionNote: input.note } });
    if (!done.count) throw new DomainError("Ce transfert vient d'être modifié. Rechargez la page.");
    const name = `${t.student.firstName} ${t.student.lastName}`;
    await audit(user, { action: "cancel", resource: "transfer", resourceId: t.id, summary: `Annulation du transfert de ${name} vers ${t.toSchool.name}`, schoolId: t.fromSchoolId });
    const recipients = [...(await familyAccounts(t.student.id)), ...(t.status === "PENDING_DESTINATION" ? await admissionStaff(t.toSchoolId) : [])];
    await notify(recipients, { kind: "transfer", title: `Transfert de ${t.student.firstName} annulé`, body: `La demande de transfert de ${name} vers ${t.toSchool.name} est annulée. L'élève reste dans son école.`, link: link(t.id) });
    return `Transfert de ${name} annulé.`;
  },
});

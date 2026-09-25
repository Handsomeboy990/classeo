"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";

import { MAX_PENDING_PROPOSALS, normalizeSubjectCode, SUBJECT_CODE } from "./labels";

type User = NonNullable<CurrentUser>;

const id = z.string().trim().min(1).max(64);
const code = z
  .string({ error: "Champ obligatoire." })
  .transform(normalizeSubjectCode)
  .pipe(z.string().min(1, "Champ obligatoire.").regex(SUBJECT_CODE, "Code court en majuscules, par exemple SVT ou P-FR (8 caractères par partie)."));
const name = z.string({ error: "Champ obligatoire." }).trim().min(2, "Le nom compte au moins 2 caractères.").max(80, "80 caractères au maximum.");

// The catalogue belongs to the ministry: only a national account writes it.
function assertMinistry(user: User) {
  if (user.scope.level !== "NATIONAL") throw new DomainError("Le catalogue des matières est géré par le ministère.");
}

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function schoolDirectors(schoolId: string) {
  const users = await db.user.findMany({ where: { isActive: true, schoolId, scopeLevel: "SCHOOL", role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true }, take: 20 });
  return users.map((u) => u.id);
}

export const createSubject = createAction({
  permission: "subject:create",
  schema: z.object({ code, name }),
  handler: async (input, user) => {
    assertMinistry(user);
    try {
      const subject = await db.subject.create({ data: { code: input.code, name: input.name, status: "APPROVED" }, select: { id: true } });
      await audit(user, { action: "create", resource: "subject", resourceId: subject.id, summary: `Matière ${input.name} (${input.code}) ajoutée au catalogue` });
    } catch (error) {
      if (isUnique(error)) throw new DomainError(`Le code ${input.code} est déjà utilisé.`);
      throw error;
    }
    return `${input.name} ajoutée au catalogue : tous les établissements peuvent l'utiliser.`;
  },
});

// The code stays as created: mock exams and exports refer to it.
export const renameSubject = createAction({
  permission: "subject:update",
  schema: z.object({ id, name }),
  handler: async (input, user) => {
    assertMinistry(user);
    const subject = await db.subject.findUnique({ where: { id: input.id }, select: { id: true, name: true, code: true, status: true } });
    if (!subject || subject.status !== "APPROVED") throw new DomainError("Matière introuvable dans le catalogue.");
    await db.subject.update({ where: { id: subject.id }, data: { name: input.name } });
    await audit(user, { action: "update", resource: "subject", resourceId: subject.id, summary: `Matière ${subject.code} renommée : ${subject.name} devient ${input.name}` });
    return `Matière renommée en ${input.name}.`;
  },
});

export const deleteSubject = createAction({
  permission: "subject:delete",
  schema: z.object({ id }),
  handler: async (input, user) => {
    assertMinistry(user);
    const subject = await db.subject.findUnique({ where: { id: input.id }, select: { id: true, name: true, code: true, _count: { select: { assignments: true } } } });
    if (!subject) throw new DomainError("Matière introuvable.");
    if (subject._count.assignments) throw new DomainError(`${subject.name} est enseignée dans ${subject._count.assignments} classe${subject._count.assignments > 1 ? "s" : ""} : elle ne peut pas être supprimée.`);
    await db.subject.delete({ where: { id: subject.id } });
    await audit(user, { action: "delete", resource: "subject", resourceId: subject.id, summary: `Matière ${subject.name} (${subject.code}) retirée du catalogue` });
    return `${subject.name} retirée du catalogue.`;
  },
});

// A school cannot create a subject: it proposes one, which waits for the
// ministry. The school comes from the session, never from the form.
export const proposeSubject = createAction({
  permission: "request:create",
  schema: z.object({ code, name }),
  handler: async (input, user) => {
    const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
    if (!schoolId) throw new DomainError("Seul un établissement propose une matière.");
    const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { id: true, name: true } });
    if (!school) throw new DomainError("Établissement introuvable.");
    const pending = await db.subject.count({ where: { requestedBySchoolId: school.id, status: "PENDING" } });
    if (pending >= MAX_PENDING_PROPOSALS) throw new DomainError(`Votre établissement a déjà ${pending} propositions en attente : attendez la décision du ministère.`);
    const sameName = await db.subject.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, status: { in: ["APPROVED", "PENDING"] } }, select: { status: true } });
    if (sameName) throw new DomainError(sameName.status === "APPROVED" ? `${input.name} existe déjà au catalogue.` : `${input.name} a déjà été proposée et attend la décision du ministère.`);
    let subjectId: string;
    try {
      subjectId = (await db.subject.create({ data: { code: input.code, name: input.name, status: "PENDING", requestedBySchoolId: school.id }, select: { id: true } })).id;
    } catch (error) {
      if (isUnique(error)) throw new DomainError(`Le code ${input.code} est déjà utilisé : choisissez-en un autre.`);
      throw error;
    }
    await audit(user, { action: "create", resource: "subject", resourceId: subjectId, schoolId: school.id, summary: `Proposition de la matière ${input.name} (${input.code})` });
    const ministry = await db.user.findMany({
      where: { isActive: true, scopeLevel: "NATIONAL", role: { permissions: { some: { permission: { code: "subject:approve" } } } } },
      select: { id: true },
      take: 200,
    });
    await notify(
      ministry.map((u) => u.id),
      { kind: "request", title: "Nouvelle matière proposée", body: `${school.name} propose la matière ${input.name} (${input.code}).`, link: "/espace/matieres?statut=PENDING" },
    );
    return "Proposition envoyée au ministère. Vous serez prévenu de sa décision.";
  },
});

export const decideSubject = createAction({
  permission: "subject:approve",
  schema: z
    .object({
      id,
      decision: z.enum(["APPROVED", "REJECTED"], "Choisissez une décision."),
      note: z
        .string()
        .trim()
        .max(500, "500 caractères au maximum.")
        .optional()
        .transform((v) => v || null),
    })
    .superRefine((v, ctx) => {
      if (v.decision === "REJECTED" && (!v.note || v.note.length < 5)) ctx.addIssue({ code: "custom", path: ["note"], message: "Expliquez le refus à l'établissement (5 caractères minimum)." });
    }),
  handler: async (input, user) => {
    assertMinistry(user);
    const subject = await db.subject.findUnique({ where: { id: input.id }, select: { id: true, code: true, name: true, status: true, requestedBySchoolId: true } });
    if (!subject) throw new DomainError("Proposition introuvable.");
    // Conditional update: two agents deciding at once, only the first wins.
    const { count } = await db.subject.updateMany({ where: { id: subject.id, status: "PENDING" }, data: { status: input.decision, decisionNote: input.note } });
    if (!count) throw new DomainError("Cette proposition a déjà été traitée.");
    const approved = input.decision === "APPROVED";
    await audit(user, {
      action: "approve",
      resource: "subject",
      resourceId: subject.id,
      schoolId: subject.requestedBySchoolId,
      summary: `Matière ${subject.name} (${subject.code}) ${approved ? "acceptée au catalogue" : "refusée"}`,
      metadata: { decision: input.decision },
    });
    if (subject.requestedBySchoolId)
      await notify(await schoolDirectors(subject.requestedBySchoolId), {
        kind: "request",
        title: approved ? "Matière acceptée" : "Matière refusée",
        body: approved
          ? `${subject.name} est au catalogue national : vous pouvez l'attribuer à vos classes.${input.note ? ` ${input.note}` : ""}`
          : `${subject.name} n'est pas retenue. Motif : ${input.note}`,
        link: `/espace/matieres?statut=${input.decision}`,
      });
    return approved ? `${subject.name} rejoint le catalogue de tous les établissements.` : `Proposition ${subject.name} refusée. L'établissement est prévenu.`;
  },
});

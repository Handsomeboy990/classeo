"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { id, requireActiveYear } from "@/features/classes/academic";
import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import type { PermissionCode } from "@/lib/auth/permissions";
import { communeWhere, departmentWhere, isTeacherRole, schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { isEnabled } from "@/lib/features";
import { assertWritable } from "@/lib/guards";
import { guardianUserIds, notify } from "@/lib/notify";
import { plural } from "@/lib/utils";

import { getExam, writableClassrooms, type ExamDetail } from "./queries";
import {
  APPROVER_LABELS,
  approvalLevel,
  canDecideAt,
  canRespond,
  canSubmit,
  datesError,
  isExamLevel,
  organizerLevelOf,
  resultsOpen,
  TAKES_PART,
  type Participation,
} from "./rules";

type User = NonNullable<CurrentUser>;

const MAX_SCHOOLS = 3000;
const link = (examId: string) => `/espace/examens-blancs/${examId}`;

async function assertFeature() {
  if (!(await isEnabled("exams.mock"))) throw new DomainError("Les examens blancs ne sont pas activés sur la plateforme.");
}

async function findExam(user: User, examId: string) {
  const exam = await getExam(user, examId);
  if (!exam) throw new DomainError("Examen blanc introuvable ou hors de votre périmètre.");
  return exam;
}

// School accounts holding a permission: the heads who answer, organise or
// are told about an exam.
async function schoolStaff(schoolIds: string[], permission: PermissionCode) {
  if (!schoolIds.length) return [];
  const rows = await db.user.findMany({
    where: { isActive: true, scopeLevel: "SCHOOL", schoolId: { in: schoolIds }, role: { permissions: { some: { permission: { code: permission } } } } },
    select: { id: true },
    take: 5000,
  });
  return rows.map((r) => r.id);
}

// The approvers of the required level for these schools.
async function approvers(level: "COMMUNE" | "DEPARTMENT" | "NATIONAL", schools: { communeId: string; departmentId: string }[]) {
  const where: Prisma.UserWhereInput =
    level === "NATIONAL"
      ? { scopeLevel: "NATIONAL" }
      : level === "DEPARTMENT"
        ? { scopeLevel: "DEPARTMENT", departmentId: schools[0]?.departmentId ?? "__none__" }
        : { scopeLevel: "COMMUNE", communeId: schools[0]?.communeId ?? "__none__" };
  const rows = await db.user.findMany({
    where: { AND: [where, { isActive: true, role: { permissions: { some: { permission: { code: "mock_exam:approve" } } } } }] },
    select: { id: true },
    take: 200,
  });
  return rows.map((r) => r.id);
}

const territoryOf = (p: ExamDetail["participants"][number]) => ({ communeId: p.school.communeId, departmentId: p.school.commune.departmentId });

// Schools still in the exam for the approval: the organiser, the partners
// that accepted and those that have not answered yet.
const approvalSchools = (exam: ExamDetail) => exam.participants.filter((p) => p.status !== "DECLINED").map(territoryOf);

const dateField = (label: string) =>
  z
    .string({ error: `${label} : champ obligatoire.` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} : date invalide.`)
    .transform((v) => new Date(`${v}T00:00:00Z`))
    .refine((d) => !Number.isNaN(d.getTime()), `${label} : date invalide.`);

const idList = (max: number) =>
  z
    .union([id, z.array(id)])
    .optional()
    .transform((v) => [...new Set(v === undefined ? [] : Array.isArray(v) ? v : [v])])
    .pipe(z.array(z.string()).max(max, `${max} établissements au maximum.`));

const codeList = z
  .union([z.string().trim().min(1).max(20), z.array(z.string().trim().min(1).max(20))], { error: "Choisissez au moins une matière." })
  .transform((v) => [...new Set(Array.isArray(v) ? v : [v])])
  .pipe(z.array(z.string()).min(1, "Choisissez au moins une matière.").max(15, "15 matières au maximum."));

// Partner schools a school organiser may invite: active schools of its
// department teaching the level this year, never itself.
async function resolvePartners(organizer: { id: string; departmentId: string }, ids: string[], levelId: string, yearId: string) {
  if (!ids.length) return [];
  const rows = await db.school.findMany({
    where: {
      id: { in: ids, not: organizer.id },
      isActive: true,
      status: "ACTIVE",
      commune: { departmentId: organizer.departmentId },
      classrooms: { some: { academicYearId: yearId, levelId } },
    },
    select: { id: true, name: true },
  });
  if (rows.length !== ids.length) throw new DomainError("Un établissement choisi ne peut pas être invité : il doit être de votre département et avoir une classe de ce niveau.");
  return rows;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createExam = createAction({
  permission: "mock_exam:create",
  schema: z.object({
    title: z.string({ error: "Champ obligatoire." }).trim().min(5, "Le titre doit compter au moins 5 caractères.").max(120, "120 caractères au maximum."),
    levelId: id,
    startDate: dateField("Début"),
    endDate: dateField("Fin"),
    subjects: codeList,
    // School organiser: the partners invited.
    partnerIds: idList(30),
    // Authority organiser: which schools must take part.
    target: z.enum(["scope", "commune", "department", "list"]).optional(),
    communeId: z.string().trim().max(64).optional(),
    departmentId: z.string().trim().max(64).optional(),
    schoolIds: idList(MAX_SCHOOLS),
  }),
  handler: async (input, user) => {
    await assertFeature();
    const level = organizerLevelOf(user.scope.level);
    if (!level || isTeacherRole(user)) throw new DomainError("Seuls un chef d'établissement, une circonscription, une direction départementale ou le ministère organisent un examen blanc.");
    const year = await requireActiveYear();

    const examLevel = await db.academicLevel.findUnique({ where: { id: input.levelId }, select: { id: true, code: true, name: true } });
    if (!examLevel || !isExamLevel(examLevel.code)) return fieldError("levelId", "Choisissez une classe d'examen : CM2, 3e ou Tle.");
    const dates = datesError(input.startDate, input.endDate, year);
    if (dates) return fieldError("endDate", dates);

    // Subjects of the approved catalogue taught at this level.
    const known = await db.subject.count({
      where: { code: { in: input.subjects }, status: "APPROVED", assignments: { some: { classroom: { levelId: examLevel.id, academicYearId: year.id } } } },
    });
    if (known !== input.subjects.length) return fieldError("subjects", "Une matière choisie n'est pas au catalogue approuvé pour ce niveau.");

    let participants: Prisma.MockExamParticipantCreateManyExamInput[];
    let notifySchools: string[];
    let organizer: { schoolId: string | null; communeId: string | null; departmentId: string | null };
    const now = new Date();

    if (level === "SCHOOL") {
      const school = await db.school.findFirst({
        where: { AND: [{ id: user.scope.schoolId ?? "__none__" }, schoolWhere(user)] },
        select: { id: true, communeId: true, commune: { select: { departmentId: true } }, classrooms: { where: { academicYearId: year.id, levelId: examLevel.id }, select: { id: true }, take: 1 } },
      });
      if (!school) throw new DomainError("Établissement introuvable.");
      await assertWritable({ schoolId: school.id, academicYearId: year.id });
      const partners = await resolvePartners({ id: school.id, departmentId: school.commune.departmentId }, input.partnerIds, examLevel.id, year.id);
      if (!partners.length) return fieldError("partnerIds", "Invitez au moins un établissement partenaire.");
      organizer = { schoolId: school.id, communeId: school.communeId, departmentId: school.commune.departmentId };
      // The organiser sits the exam when it teaches the level; otherwise it
      // coordinates only.
      participants = [
        ...(school.classrooms.length ? [{ schoolId: school.id, status: "ACCEPTED" as const, respondedAt: now, respondedById: user.id }] : []),
        ...partners.map((p) => ({ schoolId: p.id, status: "INVITED" as const })),
      ];
      notifySchools = partners.map((p) => p.id);
    } else {
      await assertWritable({ schoolId: null, academicYearId: year.id });
      const target = input.target ?? "scope";
      const and: Prisma.SchoolWhereInput[] = [schoolWhere(user), { isActive: true, status: "ACTIVE" }, { classrooms: { some: { academicYearId: year.id, levelId: examLevel.id } } }];
      if (target === "commune") {
        const commune = input.communeId ? await db.commune.findFirst({ where: { AND: [{ id: input.communeId }, communeWhere(user)] }, select: { id: true } }) : null;
        if (!commune) return fieldError("communeId", "Choisissez une commune de votre périmètre.");
        and.push({ communeId: commune.id });
      } else if (target === "department") {
        const dep = input.departmentId ? await db.department.findFirst({ where: { AND: [{ id: input.departmentId }, departmentWhere(user)] }, select: { id: true } }) : null;
        if (!dep) return fieldError("departmentId", "Choisissez un département de votre périmètre.");
        and.push({ commune: { departmentId: dep.id } });
      } else if (target === "list") {
        if (!input.schoolIds.length) return fieldError("schoolIds", "Choisissez au moins un établissement.");
        and.push({ id: { in: input.schoolIds } });
      }
      const schools = await db.school.findMany({ where: { AND: and }, select: { id: true }, take: MAX_SCHOOLS + 1 });
      if (target === "list" && schools.length !== input.schoolIds.length) return fieldError("schoolIds", "Un établissement choisi est hors de votre périmètre ou n'a pas de classe de ce niveau.");
      if (!schools.length) return fieldError("target", "Aucun établissement de ce périmètre n'a de classe de ce niveau.");
      if (schools.length > MAX_SCHOOLS) return fieldError("target", `${MAX_SCHOOLS} établissements au maximum par examen.`);
      organizer = {
        schoolId: null,
        communeId: level === "COMMUNE" ? user.scope.communeId : null,
        departmentId: level === "COMMUNE" || level === "DEPARTMENT" ? user.scope.departmentId : null,
      };
      participants = schools.map((s) => ({ schoolId: s.id, status: "IMPOSED" as const }));
      notifySchools = schools.map((s) => s.id);
    }

    // An exam decided by an authority needs no approval beyond its creator.
    const imposed = level !== "SCHOOL";
    const exam = await db.mockExam.create({
      data: {
        title: input.title,
        levelId: examLevel.id,
        academicYearId: year.id,
        organizerLevel: level,
        organizerSchoolId: organizer.schoolId,
        organizerCommuneId: organizer.communeId,
        organizerDepartmentId: organizer.departmentId,
        createdById: user.id,
        startDate: input.startDate,
        endDate: input.endDate,
        subjects: input.subjects,
        status: imposed ? "APPROVED" : "DRAFT",
        ...(imposed ? { decidedById: user.id, decidedAt: now } : {}),
        participants: { createMany: { data: participants } },
      },
      select: { id: true },
    });

    await audit(user, {
      action: "create",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId: organizer.schoolId,
      summary: imposed
        ? `Examen blanc « ${input.title} » (${examLevel.name}) décidé, participation imposée à ${plural(participants.length, "établissement")}`
        : `Examen blanc « ${input.title} » (${examLevel.name}) créé, ${plural(notifySchools.length, "établissement invité", "établissements invités")}`,
      metadata: { step: "create", level: examLevel.code, schools: participants.length, imposed },
    });

    const heads = await schoolStaff(notifySchools, imposed ? "mock_exam:view" : "mock_exam:approve");
    await notify(
      heads.filter((u) => u !== user.id),
      imposed
        ? { kind: "mock_exam", title: "Examen blanc imposé", body: `${input.title} (${examLevel.name}) : votre établissement y participe obligatoirement.`, link: link(exam.id) }
        : { kind: "mock_exam", title: "Invitation à un examen blanc", body: `${input.title} (${examLevel.name}) : acceptez ou déclinez l'invitation.`, link: link(exam.id) },
    );
    redirect(link(exam.id));
  },
});

// A refusal found after parsing, because it needs the database. The form
// shows it as a message; the field name documents which input is at fault.
function fieldError(field: string, message: string): never {
  void field;
  throw new DomainError(message);
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const inviteSchools = createAction({
  permission: "mock_exam:create",
  schema: z.object({ examId: id, partnerIds: idList(30) }),
  handler: async ({ examId, partnerIds }, user) => {
    await assertFeature();
    const exam = await findExam(user, examId);
    if (!exam.viewerIsOrganizer || exam.organizerLevel !== "SCHOOL" || isTeacherRole(user)) throw new DomainError("Seul l'établissement organisateur invite des partenaires.");
    if (exam.status !== "DRAFT" && exam.status !== "REJECTED") throw new DomainError("Les invitations sont closes : l'examen a été soumis à la validation.");
    await assertWritable({ schoolId: exam.organizerSchoolId, academicYearId: exam.academicYearId });
    const already = new Set(exam.participants.map((p) => p.schoolId));
    const fresh = partnerIds.filter((s) => !already.has(s));
    if (!fresh.length) throw new DomainError("Choisissez au moins un nouvel établissement.");
    const organizerSchool = exam.participants.find((p) => p.isOrganizer)?.school;
    const departmentId = organizerSchool?.commune.departmentId ?? exam.organizerDepartmentId ?? "__none__";
    const partners = await resolvePartners({ id: exam.organizerSchoolId!, departmentId }, fresh, exam.levelId, exam.academicYearId);
    await db.mockExamParticipant.createMany({ data: partners.map((p) => ({ examId: exam.id, schoolId: p.id, status: "INVITED" as const })), skipDuplicates: true });
    await audit(user, {
      action: "update",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId: exam.organizerSchoolId,
      summary: `Examen blanc « ${exam.title} » : invitation de ${partners.map((p) => p.name).join(", ")}`,
      metadata: { step: "invite", schools: partners.map((p) => p.id) },
    });
    await notify(await schoolStaff(partners.map((p) => p.id), "mock_exam:approve"), {
      kind: "mock_exam",
      title: "Invitation à un examen blanc",
      body: `${exam.title} (${exam.level?.name ?? ""}) : acceptez ou déclinez l'invitation.`,
      link: link(exam.id),
    });
    return `${plural(partners.length, "établissement invité", "établissements invités")}.`;
  },
});

export const respondInvitation = createAction({
  permission: "mock_exam:approve",
  schema: z.object({
    examId: id,
    decision: z.enum(["ACCEPTED", "DECLINED"], "Choisissez une réponse."),
    note: z.string().trim().max(500, "500 caractères au maximum.").optional(),
  }),
  handler: async ({ examId, decision, note }, user) => {
    await assertFeature();
    const schoolId = user.scope.level === "SCHOOL" ? user.scope.schoolId : null;
    if (!schoolId || isTeacherRole(user)) throw new DomainError("Seule la direction de l'établissement invité répond à l'invitation.");
    const exam = await findExam(user, examId);
    const mine = exam.participants.find((p) => p.schoolId === schoolId);
    if (!mine) throw new DomainError("Votre établissement n'est pas invité à cet examen.");
    if (mine.status === "IMPOSED") throw new DomainError("La participation est imposée par l'autorité : elle ne se décline pas.");
    if (!canRespond(exam, mine.status as Participation)) throw new DomainError("Cette invitation ne peut plus recevoir de réponse.");
    await assertWritable({ schoolId, academicYearId: exam.academicYearId });
    const { count } = await db.mockExamParticipant.updateMany({
      where: { id: mine.id, status: "INVITED" },
      data: { status: decision, respondedAt: new Date(), respondedById: user.id },
    });
    if (!count) throw new DomainError("Cette invitation vient de recevoir une réponse.");
    const verb = decision === "ACCEPTED" ? "acceptée" : "déclinée";
    await audit(user, {
      action: "approve",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId,
      summary: `Examen blanc « ${exam.title} » : invitation ${verb} par ${mine.school.name}${note ? `. ${note}` : ""}`,
      metadata: { step: decision === "ACCEPTED" ? "accept" : "decline", schoolId },
    });
    const organizers = exam.organizerSchoolId ? await schoolStaff([exam.organizerSchoolId], "mock_exam:create") : [];
    await notify([...organizers, exam.createdById], {
      kind: "mock_exam",
      title: `Invitation ${verb}`,
      body: `${mine.school.name} a ${verb === "acceptée" ? "accepté" : "décliné"} l'examen blanc « ${exam.title} ».${note ? ` ${note.slice(0, 160)}` : ""}`,
      link: link(exam.id),
    });
    return decision === "ACCEPTED" ? "Invitation acceptée. L'organisateur est notifié." : "Invitation déclinée. L'organisateur est notifié.";
  },
});

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export const submitExam = createAction({
  permission: "mock_exam:create",
  schema: z.object({ examId: id }),
  handler: async ({ examId }, user) => {
    await assertFeature();
    const exam = await findExam(user, examId);
    if (!exam.viewerIsOrganizer || isTeacherRole(user)) throw new DomainError("Seul l'établissement organisateur soumet l'examen.");
    if (!canSubmit(exam, exam.participants.map((p) => ({ status: p.status as Participation, isOrganizer: p.isOrganizer }))))
      throw new DomainError("L'examen ne peut être soumis qu'après l'acceptation d'au moins un établissement invité.");
    await assertWritable({ schoolId: exam.organizerSchoolId, academicYearId: exam.academicYearId });
    const schools = approvalSchools(exam);
    const required = approvalLevel(schools);
    const { count } = await db.mockExam.updateMany({
      where: { id: exam.id, status: { in: ["DRAFT", "REJECTED"] } },
      data: { status: "PENDING_APPROVAL", decidedById: null, decidedAt: null, decisionNote: null },
    });
    if (!count) throw new DomainError("Cet examen vient d'être soumis.");
    await audit(user, {
      action: "update",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId: exam.organizerSchoolId,
      summary: `Examen blanc « ${exam.title} » soumis à la validation de ${APPROVER_LABELS[required]}`,
      metadata: { step: "submit", approvalLevel: required },
    });
    await notify(await approvers(required, schools), {
      kind: "mock_exam",
      title: "Examen blanc à valider",
      body: `${exam.organizerName} propose « ${exam.title} » (${exam.level?.name ?? ""}) avec ${plural(schools.length - 1, "établissement partenaire", "établissements partenaires")}.`,
      link: link(exam.id),
    });
    return `Examen soumis à ${APPROVER_LABELS[required]}. Vous serez notifié de la décision.`;
  },
});

export const decideExam = createAction({
  permission: "mock_exam:approve",
  schema: z.object({
    examId: id,
    decision: z.enum(["APPROVED", "REJECTED"], "Choisissez une décision."),
    note: z.string({ error: "Motivez la décision." }).trim().min(5, "Motivez la décision (5 caractères minimum).").max(2000, "2 000 caractères maximum."),
  }),
  handler: async ({ examId, decision, note }, user) => {
    await assertFeature();
    const exam = await findExam(user, examId);
    if (exam.status !== "PENDING_APPROVAL") throw new DomainError("Cet examen n'attend pas de validation.");
    const schools = approvalSchools(exam);
    const required = approvalLevel(schools);
    if (!canDecideAt(user.scope, required, schools)) throw new DomainError(`Cet examen relève de ${APPROVER_LABELS[required]}.`);
    await assertWritable({ schoolId: null, academicYearId: exam.academicYearId });
    const { count } = await db.mockExam.updateMany({
      where: { id: exam.id, status: "PENDING_APPROVAL" },
      data: { status: decision, decidedById: user.id, decidedAt: new Date(), decisionNote: note },
    });
    if (!count) throw new DomainError("Cet examen vient d'être traité par un autre agent.");
    const verdict = decision === "APPROVED" ? "validé" : "refusé";
    await audit(user, {
      action: "approve",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId: exam.organizerSchoolId,
      summary: `Examen blanc « ${exam.title} » ${verdict} : ${note}`,
      metadata: { step: decision === "APPROVED" ? "approve" : "reject" },
    });
    const taking = exam.participants.filter((p) => p.status === "ACCEPTED").map((p) => p.schoolId);
    const staff = await schoolStaff([...new Set([exam.organizerSchoolId!, ...taking])], "mock_exam:view");
    await notify([...staff, exam.createdById], {
      kind: "mock_exam",
      title: `Examen blanc ${verdict}`,
      body: `« ${exam.title} » : ${note.slice(0, 180)}`,
      link: link(exam.id),
    });
    return `Examen ${verdict}. Les établissements sont notifiés.`;
  },
});

export const closeExam = createAction({
  permission: "mock_exam:create",
  schema: z.object({ examId: id }),
  handler: async ({ examId }, user) => {
    await assertFeature();
    const exam = await findExam(user, examId);
    if (!exam.viewerIsOrganizer || isTeacherRole(user)) throw new DomainError("Seul l'organisateur clôture l'examen.");
    if (exam.status !== "APPROVED") throw new DomainError("Seul un examen validé se clôture.");
    await assertWritable({ schoolId: exam.organizerSchoolId, academicYearId: exam.academicYearId });
    const { count } = await db.mockExam.updateMany({ where: { id: exam.id, status: "APPROVED" }, data: { status: "CLOSED" } });
    if (!count) throw new DomainError("Cet examen vient d'être clôturé.");
    await audit(user, {
      action: "lock",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId: exam.organizerSchoolId,
      summary: `Examen blanc « ${exam.title} » clôturé : résultats définitifs`,
      metadata: { step: "close" },
    });
    const taking = exam.participants.filter((p) => TAKES_PART.includes(p.status as Participation)).map((p) => p.schoolId);
    const candidates = await db.enrollment.findMany({
      where: { schoolId: { in: taking }, academicYearId: exam.academicYearId, status: "ACTIVE", classroom: { levelId: exam.levelId } },
      select: { id: true, student: { select: { userId: true } } },
      take: 60000,
    });
    const families = [...(await guardianUserIds(candidates.map((c) => c.id))), ...candidates.map((c) => c.student.userId).filter((v): v is string => !!v)];
    const staff = await schoolStaff(taking, "mock_exam:view");
    await notify([...staff, ...families], { kind: "mock_exam", title: "Résultats d'examen blanc", body: `Les résultats définitifs de « ${exam.title} » sont disponibles.`, link: link(exam.id) });
    return "Examen clôturé : les résultats sont définitifs et les familles sont notifiées.";
  },
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const cell = z.object({
  enrollmentId: id,
  subjectCode: z.string().trim().min(1).max(20),
  value: z
    .number()
    .min(0, "Une note est comprise entre 0 et 20.")
    .max(20, "Une note est comprise entre 0 et 20.")
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, "Deux décimales au maximum.")
    .nullable(),
});

// Bulk save of the entry grid: only changed cells travel, an empty cell
// deletes the score, everything in one transaction.
export const saveResults = createAction({
  permission: "mock_exam:update",
  schema: z.object({ examId: id, classroomId: id, cells: z.array(cell).min(1, "Aucune modification à enregistrer.").max(3000) }),
  handler: async ({ examId, classroomId, cells }, user) => {
    await assertFeature();
    const exam = await findExam(user, examId);
    if (!resultsOpen(exam)) throw new DomainError(exam.status === "APPROVED" ? "Les épreuves n'ont pas encore commencé." : "La saisie n'est possible que pour un examen validé, jusqu'à sa clôture.");
    const room = (await writableClassrooms(user, exam)).find((r) => r.id === classroomId);
    if (!room) throw new DomainError("Classe introuvable ou hors de votre périmètre.");
    const allowed = new Set(room.subjects);
    if (cells.some((c) => !allowed.has(c.subjectCode))) throw new DomainError("Vous ne pouvez saisir que les matières que vous enseignez dans cette classe.");
    await assertWritable({ schoolId: room.schoolId, academicYearId: exam.academicYearId });
    const enrollmentIds = [...new Set(cells.map((c) => c.enrollmentId))];
    const valid = await db.enrollment.count({ where: { id: { in: enrollmentIds }, classroomId: room.id, status: "ACTIVE" } });
    if (valid !== enrollmentIds.length) throw new DomainError("Un élève ne fait pas partie de cette classe.");

    const cleared = cells.filter((c) => c.value === null);
    const written = cells.filter((c) => c.value !== null);
    await db.$transaction([
      ...(cleared.length ? [db.mockExamResult.deleteMany({ where: { examId: exam.id, OR: cleared.map((c) => ({ enrollmentId: c.enrollmentId, subjectCode: c.subjectCode })) } })] : []),
      ...written.map((c) =>
        db.mockExamResult.upsert({
          where: { examId_enrollmentId_subjectCode: { examId: exam.id, enrollmentId: c.enrollmentId, subjectCode: c.subjectCode } },
          create: { examId: exam.id, enrollmentId: c.enrollmentId, subjectCode: c.subjectCode, score: c.value!, enteredById: user.id },
          update: { score: c.value!, enteredById: user.id },
        }),
      ),
    ]);
    await audit(user, {
      action: "update",
      resource: "mock_exam",
      resourceId: exam.id,
      schoolId: room.schoolId,
      summary: `Examen blanc « ${exam.title} », ${room.name} : ${plural(written.length, "note enregistrée", "notes enregistrées")}, ${plural(cleared.length, "note effacée", "notes effacées")}`,
      metadata: { step: "results", classroomId: room.id },
    });
    return `${plural(cells.length, "note enregistrée", "notes enregistrées")}.`;
  },
});

"use server";

import { z } from "zod";

import { id } from "@/features/classes/academic";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MONTH, monthLabel, nextPayrollStatus, payslipError, payslipTotals } from "@/lib/domain/payroll";
import { DomainError } from "@/lib/errors";
import { assertWritable } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { formatFcfa } from "@/lib/utils";

type User = NonNullable<CurrentUser>;

const amount = (label: string) =>
  z.coerce
    .number({ error: `${label} : montant attendu.` })
    .int(`${label} : nombre entier de francs.`)
    .min(0, `${label} : montant positif.`)
    .max(10_000_000, `${label} : montant trop élevé.`);

const note = z
  .string()
  .trim()
  .max(200, "200 caractères au maximum.")
  .optional()
  .transform((v) => v || null);

// A teacher of the head's own school: payslips never cross schools.
async function ownTeacher(user: User, teacherId: string) {
  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, school: { AND: [{ id: user.scope.schoolId ?? "__none__" }, schoolWhere(user)] } },
    select: { id: true, schoolId: true, userId: true, firstName: true, lastName: true, status: true, gender: true },
  });
  if (!teacher || user.scope.level !== "SCHOOL") throw new DomainError("Enseignant introuvable dans votre établissement.");
  await assertWritable({ schoolId: teacher.schoolId });
  return teacher;
}

async function ownPayslip(user: User, payslipId: string) {
  const p = await db.payroll.findFirst({
    where: { id: payslipId, school: { AND: [{ id: user.scope.schoolId ?? "__none__" }, schoolWhere(user)] } },
    select: { id: true, schoolId: true, month: true, status: true, netAmount: true, employeeName: true, teacher: { select: { userId: true } } },
  });
  if (!p || user.scope.level !== "SCHOOL") throw new DomainError("Bulletin de paie introuvable dans votre établissement.");
  await assertWritable({ schoolId: p.schoolId });
  return p;
}

export const savePayslip = createAction({
  permission: "payroll:create",
  schema: z.object({
    teacherId: id,
    month: z.string().regex(MONTH, "Mois invalide."),
    baseAmount: amount("Salaire de base"),
    allowances: amount("Primes"),
    allowancesNote: note,
    deductions: amount("Retenues"),
    deductionsNote: note,
  }),
  handler: async (input, user) => {
    const teacher = await ownTeacher(user, input.teacherId);
    const error = payslipError({ status: teacher.status, ...input });
    if (error) throw new DomainError(error);
    const existing = await db.payroll.findUnique({ where: { teacherId_month: { teacherId: teacher.id, month: input.month } }, select: { id: true, status: true } });
    if (existing && existing.status !== "DRAFT") throw new DomainError("Ce bulletin est déjà validé : il ne se modifie plus.");
    if (existing && !user.permissions.has("payroll:update")) throw new DomainError("Vous n'avez pas le droit de modifier un bulletin de paie.");
    const totals = payslipTotals(input);
    const data = {
      baseAmount: input.baseAmount,
      allowances: input.allowances,
      allowancesNote: input.allowancesNote,
      deductions: input.deductions,
      deductionsNote: input.deductionsNote,
      ...totals,
      employeeName: `${teacher.firstName} ${teacher.lastName}`,
    };
    const saved = existing
      ? await db.payroll.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.payroll.create({ data: { ...data, schoolId: teacher.schoolId, teacherId: teacher.id, month: input.month, createdById: user.id }, select: { id: true } });
    await audit(user, {
      action: existing ? "update" : "create",
      resource: "payroll",
      resourceId: saved.id,
      schoolId: teacher.schoolId,
      summary: `Bulletin de paie de ${teacher.firstName} ${teacher.lastName}, ${monthLabel(input.month)} : net ${formatFcfa(totals.netAmount)}`,
    });
    return `Bulletin de ${monthLabel(input.month)} enregistré en brouillon.`;
  },
});

// Validation makes the payslip visible to the teacher; payment closes it.
export const advancePayslip = createAction({
  permission: "payroll:approve",
  schema: z.object({ id }),
  handler: async (input, user) => {
    const p = await ownPayslip(user, input.id);
    const next = nextPayrollStatus(p.status);
    if (!next) return "Ce bulletin est déjà payé.";
    const now = new Date();
    const { count } = await db.payroll.updateMany({
      where: { id: p.id, status: p.status },
      data: next === "APPROVED" ? { status: next, approvedAt: now } : { status: next, paidAt: now },
    });
    if (!count) throw new DomainError("Ce bulletin vient d'être modifié. Rechargez la page.");
    await audit(user, {
      action: "approve",
      resource: "payroll",
      resourceId: p.id,
      schoolId: p.schoolId,
      summary: `Bulletin de paie de ${p.employeeName}, ${monthLabel(p.month)} : ${next === "APPROVED" ? "validé" : "payé"}`,
    });
    if (next === "APPROVED" && p.teacher?.userId)
      await notify([p.teacher.userId], {
        kind: "payroll",
        title: "Bulletin de paie disponible",
        body: `Votre bulletin de paie de ${monthLabel(p.month)} est disponible : net ${formatFcfa(p.netAmount)}.`,
        link: "/espace/ma-paie",
      });
    return next === "APPROVED" ? "Bulletin validé : l'enseignant le voit dans « Ma paie »." : "Bulletin marqué comme payé.";
  },
});

export const deletePayslip = createAction({
  permission: "payroll:delete",
  schema: z.object({ id }),
  handler: async (input, user) => {
    const p = await ownPayslip(user, input.id);
    if (p.status !== "DRAFT") throw new DomainError("Un bulletin validé ne se supprime pas.");
    await db.payroll.delete({ where: { id: p.id } });
    await audit(user, { action: "delete", resource: "payroll", resourceId: p.id, schoolId: p.schoolId, summary: `Bulletin de paie supprimé : ${p.employeeName}, ${monthLabel(p.month)}` });
    return "Brouillon supprimé.";
  },
});

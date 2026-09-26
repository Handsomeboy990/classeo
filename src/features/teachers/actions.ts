"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, isUniqueViolation, optionalPhone, optionalText, requiredText } from "@/features/classes/academic";
import type { Prisma, SchoolSector } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { allocateUsername } from "@/lib/auth/username";
import { invalidate, tags } from "@/lib/cache";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { canAssignRoleOn, generateTemporaryPassword } from "@/lib/domain/rights";
import { appointmentStatus, STATE_MATRICULE_PATTERN, STATE_STATUSES, TEACHER_STATUSES, type TeacherStatus } from "@/lib/domain/teacher-status";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { assertWritable } from "@/lib/guards";

import { schoolRef, userScopeRef } from "../territory/scope";
import { actorOf } from "../users/queries";
import { nextTeacherMatricule } from "./matricule";
import { teacherWhere } from "./queries";
import { searchRegistry } from "./registry";
import { foldName, NPI_PATTERN, parseRegistryQuery, phoneKey } from "./registry-rules";

type User = NonNullable<CurrentUser>;

const hiredAt = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || (isIsoDate(v) && v <= todayIso()), "Date invalide ou à venir.");

const npi = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\s+/g, "") : null))
  .refine((v) => v === null || NPI_PATTERN.test(v), "Le NPI compte 10 chiffres.");

const fields = {
  lastName: requiredText(60),
  firstName: requiredText(60),
  gender: z
    .enum(["F", "M", ""])
    .optional()
    .transform((v) => (v ? v : null)),
  phone: optionalPhone,
  specialty: optionalText(80),
  hiredAt,
  npi,
  // Given by the school: vacataire, or private teacher in a private school.
  // Agents of the State take the status of the ministry registry.
  status: z
    .enum(["", ...TEACHER_STATUSES])
    .optional()
    .transform((v) => (v ? v : null)),
};

function resolveStatus(input: { chosen: TeacherStatus | null; stateStatus: TeacherStatus | null; sector: SchoolSector }) {
  const r = appointmentStatus(input);
  if (!r.ok) throw new DomainError(r.reason);
  return r.status;
}

const label = (gender: string | null) => (gender === "F" ? "l'enseignante" : "l'enseignant");

// The school a head adds teachers to: their active school, inside their
// scope, open for writing.
async function ownSchool(user: User) {
  const schoolId = user.scope.schoolId;
  if (user.scope.level !== "SCHOOL" || !schoolId) throw new DomainError("L'ajout d'un enseignant se fait depuis un compte d'établissement.");
  const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { id: true, name: true, sector: true } });
  if (!school) throw new DomainError("Établissement hors de votre périmètre.");
  await assertWritable({ schoolId: school.id });
  return school;
}

// The matricule is the largest one plus one: two heads adding a teacher at
// the same moment may collide, the write is then tried again.
async function withMatricule<T>(write: (matricule: string) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await write(await nextTeacherMatricule());
    } catch (error) {
      if (!isUniqueViolation(error) || !String((error as { meta?: { target?: unknown } }).meta?.target ?? "").includes("matricule")) throw error;
    }
  }
  throw new DomainError("Le matricule n'a pas pu être attribué. Réessayez.");
}

// Step one of adding a teacher: the national registry, by NPI, phone number
// or names, so that nobody is registered twice.
export const searchTeacherRegistry = createAction({
  permission: "teacher:create",
  schema: z.object({ q: z.string().trim().min(1, "Saisissez un NPI, un numéro de téléphone ou des noms.").max(100) }),
  handler: async ({ q }, user) => {
    const school = await ownSchool(user);
    const query = parseRegistryQuery(q);
    if (!query) throw new DomainError("Saisissez au moins 8 chiffres (NPI ou téléphone) ou un nom de 2 lettres ou plus.");
    const matches = await searchRegistry(query, school.id);
    return { message: matches.length ? `${matches.length} enseignant${matches.length > 1 ? "s" : ""} trouvé${matches.length > 1 ? "s" : ""}.` : "Aucun enseignant trouvé.", data: { matches } };
  },
});

// A teacher found in the registry gets an appointment in the head's school:
// a new Teacher row sharing the profile and the account, never a copy of
// the person.
export const appointTeacher = createAction({
  permission: "teacher:create",
  schema: z.object({ profileId: id, specialty: optionalText(80) }),
  handler: async (input, user) => {
    const school = await ownSchool(user);
    const profile = await db.teacherProfile.findUnique({
      where: { id: input.profileId },
      select: { id: true, userId: true, firstName: true, lastName: true, gender: true, phone: true, stateStatus: true, teachers: { select: { schoolId: true, isActive: true, specialty: true } } },
    });
    if (!profile) throw new DomainError("Enseignant introuvable au registre.");
    const status = resolveStatus({ chosen: null, stateStatus: profile.stateStatus, sector: school.sector });
    const here = profile.teachers.find((t) => t.schoolId === school.id);
    if (here) throw new DomainError(here.isActive ? "Cet enseignant fait déjà partie de votre équipe." : "Cet enseignant figure déjà dans votre établissement, inactif : réactivez-le depuis sa fiche.");

    let teacherId: string;
    try {
      teacherId = await withMatricule(async (matricule) => {
        const t = await db.teacher.create({
          data: {
            profileId: profile.id,
            userId: profile.userId,
            schoolId: school.id,
            matricule,
            status,
            firstName: profile.firstName,
            lastName: profile.lastName,
            gender: profile.gender,
            phone: profile.phone,
            specialty: input.specialty ?? profile.teachers.find((t) => t.specialty)?.specialty ?? null,
          },
          select: { id: true },
        });
        return t.id;
      });
    } catch (error) {
      // The account already holds an appointment here (userId, schoolId).
      if (isUniqueViolation(error)) throw new DomainError("Cet enseignant fait déjà partie de votre équipe.");
      throw error;
    }
    await audit(user, {
      action: "create",
      resource: "teacher",
      resourceId: teacherId,
      schoolId: school.id,
      summary: `Nomination de ${label(profile.gender)} ${profile.firstName} ${profile.lastName}, déjà au registre, à ${school.name}`,
      metadata: { profileId: profile.id, appointments: profile.teachers.length + 1 },
    });
    invalidate(tags.stats);
    redirect(`/espace/enseignants/${teacherId}`);
  },
});

// Step two, when the registry has nobody: the profile, the appointment and,
// on request, the sign in account, in one transaction.
export const createTeacher = createAction({
  permission: "teacher:create",
  schema: z.object({
    ...fields,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || z.email().safeParse(v).success, "Adresse e-mail invalide."),
    createAccount: checkbox,
    // The head confirms that a namesake already in the registry is another
    // person.
    confirmNew: checkbox,
  }),
  handler: async (input, user) => {
    const school = await ownSchool(user);
    // A school never creates an agent of the State.
    const status = resolveStatus({ chosen: input.status, stateStatus: null, sector: school.sector });

    // The registry is checked again on the server: the search step is only
    // a convenience.
    if (input.npi && (await db.teacherProfile.count({ where: { npi: input.npi } })))
      throw new DomainError("Ce NPI figure déjà au registre national : recherchez-le et nommez l'enseignant dans votre établissement.");
    const key = phoneKey(input.phone);
    if (key) {
      const [row] = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "TeacherProfile" WHERE right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 8) = ${key}`;
      if (row && row.n > BigInt(0)) throw new DomainError("Ce numéro de téléphone figure déjà au registre national : recherchez-le et nommez l'enseignant dans votre établissement.");
    }
    if (!input.confirmNew) {
      const namesakes = await searchRegistry({ npi: null, phone: null, names: foldName(`${input.firstName} ${input.lastName}`).split(" ").filter((t) => t.length >= 2) }, school.id);
      const same = namesakes.filter((m) => foldName(`${m.firstName} ${m.lastName}`) === foldName(`${input.firstName} ${input.lastName}`));
      if (same.length)
        throw new DomainError(
          `Un enseignant du même nom figure au registre (${same[0]!.schools.join(", ") || "sans établissement"}). Recherchez-le pour le nommer, ou cochez « Il s'agit d'une autre personne ».`,
        );
    }

    let credentials: { username: string; password: string } | null = null;
    let accountRole: { id: string } | null = null;
    if (input.createAccount) {
      const role = await db.role.findUnique({ where: { code: "TEACHER" }, select: { id: true, scopeLevel: true, permissions: { select: { permission: { select: { code: true } } } } } });
      if (!role) throw new DomainError("Le rôle Enseignant est introuvable.");
      const target = await schoolRef(school.id);
      const rule = target ? canAssignRoleOn({ ...actorOf(user), scope: userScopeRef(user) }, { scopeLevel: role.scopeLevel, permissions: role.permissions.map((p) => p.permission.code) }, target.ref) : null;
      if (!rule?.ok) throw new DomainError(rule?.reason ?? "Établissement introuvable.");
      accountRole = { id: role.id };
    }
    const password = accountRole ? generateTemporaryPassword() : null;
    const passwordHash = password ? await hashPassword(password) : null;

    let teacherId: string;
    try {
      teacherId = await withMatricule((matricule) =>
        db.$transaction(async (tx: Prisma.TransactionClient) => {
          const account =
            accountRole && passwordHash
              ? await tx.user.create({
                  data: {
                    username: await allocateUsername(tx, input.firstName, input.lastName),
                    email: input.email,
                    phone: input.phone,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    gender: input.gender,
                    passwordHash,
                    mustChangePassword: true,
                    roleId: accountRole.id,
                    scopeLevel: "SCHOOL",
                    schoolId: school.id,
                  },
                  select: { id: true, username: true },
                })
              : null;
          const profile = await tx.teacherProfile.create({
            data: { userId: account?.id ?? null, npi: input.npi, firstName: input.firstName, lastName: input.lastName, gender: input.gender, phone: input.phone, email: input.email },
            select: { id: true },
          });
          const teacher = await tx.teacher.create({
            data: {
              profileId: profile.id,
              userId: account?.id ?? null,
              schoolId: school.id,
              matricule,
              status,
              firstName: input.firstName,
              lastName: input.lastName,
              gender: input.gender,
              phone: input.phone,
              specialty: input.specialty,
              hiredAt: input.hiredAt ? isoToDate(input.hiredAt) : null,
            },
            select: { id: true },
          });
          if (account && password) credentials = { username: account.username, password };
          return teacher.id;
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? "");
        if (target.includes("npi")) throw new DomainError("Ce NPI figure déjà au registre national.");
        if (target.includes("email")) throw new DomainError("Un compte existe déjà avec cette adresse e-mail.");
        throw new DomainError("L'identifiant n'a pas pu être attribué. Réessayez.");
      }
      throw error;
    }

    const issued = credentials as { username: string; password: string } | null;
    await audit(user, {
      action: "create",
      resource: "teacher",
      resourceId: teacherId,
      schoolId: school.id,
      summary: `Ajout de ${label(input.gender)} ${input.firstName} ${input.lastName} au registre national et à ${school.name}${issued ? `, compte ${issued.username}` : ""}`,
      metadata: { npi: !!input.npi, account: !!issued },
    });
    invalidate(tags.stats);
    if (!issued) redirect(`/espace/enseignants/${teacherId}`);
    return { message: "Enseignant ajouté avec son compte.", data: { teacherId, username: issued.username, password: issued.password, mail: "skipped" as const } };
  },
});

export const updateTeacher = createAction({
  permission: "teacher:update",
  schema: z.object({ id, ...fields, isActive: checkbox }),
  handler: async (input, user) => {
    const teacher = await db.teacher.findFirst({
      where: { AND: [{ id: input.id }, teacherWhere(user)] },
      select: { id: true, schoolId: true, isActive: true, profileId: true, school: { select: { sector: true } }, profile: { select: { npi: true, stateStatus: true } } },
    });
    if (!teacher) throw new DomainError("Enseignant introuvable ou hors de votre périmètre.");
    await assertWritable({ schoolId: teacher.schoolId });
    const { id: teacherId, hiredAt: hired, npi: newNpi, status: chosen, ...rest } = input;
    const data = { ...rest, status: resolveStatus({ chosen, stateStatus: teacher.profile?.stateStatus ?? null, sector: teacher.school.sector }) };
    try {
      await db.$transaction([
        db.teacher.update({ where: { id: teacherId }, data: { ...data, hiredAt: hired ? isoToDate(hired) : null } }),
        // The person's identity lives in the registry: names, phone and NPI
        // follow. An NPI already recorded is never erased from a school.
        ...(teacher.profileId
          ? [
              db.teacherProfile.update({
                where: { id: teacher.profileId },
                data: { firstName: rest.firstName, lastName: rest.lastName, gender: rest.gender, phone: rest.phone, ...(newNpi ? { npi: newNpi } : {}) },
              }),
            ]
          : []),
      ]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError("Ce NPI est déjà attribué à une autre personne du registre.");
      throw error;
    }
    await audit(user, {
      action: "update",
      resource: "teacher",
      resourceId: teacher.id,
      summary: `Modification de ${label(input.gender)} ${input.firstName} ${input.lastName}${teacher.isActive !== input.isActive ? `, ${input.isActive ? "réactivé" : "désactivé"}${input.gender === "F" ? "e" : ""}` : ""}`,
      schoolId: teacher.schoolId,
    });
    if (teacher.isActive !== input.isActive) invalidate(tags.stats);
    return "Enseignant enregistré.";
  },
});

// The ministry's registry of State teachers: an agent is recorded (or an
// existing registry entry completed) with the status and the State
// matricule. Only the national level writes it; a school appoints the
// agents it finds there. Appointments in public schools take the status.
export const recordStateTeacher = createAction({
  permission: "teacher:update",
  schema: z.object({
    profileId: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((v) => v || null),
    lastName: requiredText(60),
    firstName: requiredText(60),
    gender: fields.gender,
    phone: optionalPhone,
    npi,
    stateStatus: z.enum(STATE_STATUSES, "Choisissez le statut : APE, ACE ou AME."),
    stateMatricule: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/\s+/g, ""))
      .pipe(z.string().regex(STATE_MATRICULE_PATTERN, "Le matricule de l'État compte 4 à 20 chiffres ou lettres.")),
  }),
  handler: async (input, user) => {
    if (user.scope.level !== "NATIONAL") throw new DomainError("Le registre des agents de l'État est tenu par le ministère.");
    const { profileId, ...data } = input;
    let id: string;
    try {
      if (profileId) {
        const existing = await db.teacherProfile.findUnique({ where: { id: profileId }, select: { id: true, npi: true } });
        if (!existing) throw new DomainError("Enseignant introuvable au registre.");
        await db.$transaction([
          db.teacherProfile.update({
            where: { id: existing.id },
            data: { ...data, npi: existing.npi ?? data.npi },
          }),
          db.teacher.updateMany({ where: { profileId: existing.id, school: { sector: "PUBLIC" } }, data: { status: data.stateStatus } }),
        ]);
        id = existing.id;
      } else {
        const created = await db.teacherProfile.create({ data, select: { id: true } });
        id = created.id;
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? "");
        throw new DomainError(target.includes("npi") ? "Ce NPI figure déjà au registre." : "Ce matricule de l'État est déjà attribué à une autre personne.");
      }
      throw error;
    }
    await audit(user, {
      action: profileId ? "update" : "create",
      resource: "teacher",
      resourceId: id,
      summary: `${profileId ? "Mise à jour" : "Inscription"} au registre des agents de l'État : ${input.firstName} ${input.lastName}, ${input.stateStatus}, matricule ${input.stateMatricule}`,
    });
    invalidate(tags.stats);
    return profileId ? "Fiche du registre mise à jour." : "Agent inscrit au registre. Les établissements peuvent désormais le nommer.";
  },
});

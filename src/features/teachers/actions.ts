"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkbox, id, isUniqueViolation, optionalPhone, optionalText, requiredText } from "@/features/classes/academic";
import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { allocateUsername } from "@/lib/auth/username";
import { invalidate, tags } from "@/lib/cache";
import { isIsoDate, isoToDate, todayIso } from "@/lib/domain/attendance";
import { canAssignRoleOn, generateTemporaryPassword } from "@/lib/domain/rights";
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
};

const label = (gender: string | null) => (gender === "F" ? "l'enseignante" : "l'enseignant");

// The school a head adds teachers to: their active school, inside their
// scope, open for writing.
async function ownSchool(user: User) {
  const schoolId = user.scope.schoolId;
  if (user.scope.level !== "SCHOOL" || !schoolId) throw new DomainError("L'ajout d'un enseignant se fait depuis un compte d'établissement.");
  const school = await db.school.findFirst({ where: { AND: [{ id: schoolId }, schoolWhere(user)] }, select: { id: true, name: true } });
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
      select: { id: true, userId: true, firstName: true, lastName: true, gender: true, phone: true, teachers: { select: { schoolId: true, isActive: true, specialty: true } } },
    });
    if (!profile) throw new DomainError("Enseignant introuvable au registre.");
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
    const teacher = await db.teacher.findFirst({ where: { AND: [{ id: input.id }, teacherWhere(user)] }, select: { id: true, schoolId: true, isActive: true, profileId: true, profile: { select: { npi: true } } } });
    if (!teacher) throw new DomainError("Enseignant introuvable ou hors de votre périmètre.");
    await assertWritable({ schoolId: teacher.schoolId });
    const { id: teacherId, hiredAt: hired, npi: newNpi, ...data } = input;
    try {
      await db.$transaction([
        db.teacher.update({ where: { id: teacherId }, data: { ...data, hiredAt: hired ? isoToDate(hired) : null } }),
        // The person's identity lives in the registry: names, phone and NPI
        // follow. An NPI already recorded is never erased from a school.
        ...(teacher.profileId
          ? [
              db.teacherProfile.update({
                where: { id: teacher.profileId },
                data: { firstName: data.firstName, lastName: data.lastName, gender: data.gender, phone: data.phone, ...(newNpi ? { npi: newNpi } : {}) },
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

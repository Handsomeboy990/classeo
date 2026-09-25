import { createHash } from "node:crypto";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { initialsAvatarPng } from "../../src/features/students/avatar-png";

import type { SeedContext } from "./index";

// Student lifecycle demonstration data: photos (neutral initials avatars,
// never a real person), transfers at each stage, and a shared record.
// Deterministic: every choice is ordered by matricule, every date is fixed.

const at = (iso: string) => new Date(iso);

async function schoolByName(db: PrismaClient, name: string) {
  return db.school.findFirstOrThrow({ where: { name }, select: { id: true, name: true } });
}

async function directorOf(db: PrismaClient, schoolId: string) {
  const u = await db.user.findFirst({ where: { schoolId, role: { code: "SCHOOL_DIRECTOR" } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return u?.id ?? null;
}

async function admissionStaff(db: PrismaClient, schoolId: string) {
  const users = await db.user.findMany({
    where: { schoolId, isActive: true, scopeLevel: "SCHOOL", role: { permissions: { some: { permission: { code: "student:create" } } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// Active enrollments of a class of the active year, by level and letter.
async function firstPupils(db: PrismaClient, schoolId: string, yearId: string, className: string, take: number, skip = 0) {
  return db.enrollment.findMany({
    where: { schoolId, academicYearId: yearId, status: "ACTIVE", classroom: { name: className } },
    orderBy: { student: { matricule: "asc" } },
    skip,
    take,
    select: { id: true, classroomId: true, classroom: { select: { levelId: true } }, student: { select: { id: true, firstName: true, lastName: true, gender: true } } },
  });
}

async function addPhoto(db: PrismaClient, ownerUserId: string, student: { id: string; firstName: string; lastName: string }) {
  const png = initialsAvatarPng(student.firstName, student.lastName);
  const file = await db.fileBlob.create({
    data: {
      ownerUserId,
      purpose: "student_photo",
      fileName: `photo-${student.lastName}-${student.firstName}.png`.normalize("NFD").replace(/[^\w.-]/g, ""),
      mimeType: "image/png",
      size: png.byteLength,
      sha256: createHash("sha256").update(png).digest("hex"),
      data: png,
    },
    select: { id: true },
  });
  await db.student.update({ where: { id: student.id }, data: { photoFileId: file.id } });
}

export async function seedLifecycle(db: PrismaClient, ctx: SeedContext) {
  const { ceg } = ctx.schools;
  const yearId = ctx.yearId;
  const director = ctx.ids.director;

  // Photos: the demo family's two children and a dozen pupils of 3e A --------
  const family = await db.student.findMany({
    where: { guardians: { some: { guardian: { userId: ctx.ids.parent } } } },
    orderBy: { matricule: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });
  const classmates = await firstPupils(db, ceg, yearId, "3e A", 13);
  const photographed = new Set<string>();
  for (const s of [...family, ...classmates.map((e) => e.student)]) {
    if (photographed.has(s.id) || photographed.size >= 14) continue;
    photographed.add(s.id);
    await addPhoto(db, director, s);
  }

  // 1. A school change waiting for the guardian ------------------------------
  // A 4e A pupil of CEG Godomey whose mother, Colette Dossa, has an account.
  const calavi = await schoolByName(db, "CEG Abomey-Calavi");
  const [koffi] = await firstPupils(db, ceg, yearId, "4e A", 1);
  if (koffi) {
    const first = koffi.student.gender === "F" ? "Afi" : "Koffi";
    await db.student.update({ where: { id: koffi.student.id }, data: { firstName: first, lastName: "Dossa" } });
    await addPhoto(db, director, { id: koffi.student.id, firstName: first, lastName: "Dossa" });
    const parentRole = await db.role.findUniqueOrThrow({ where: { code: "PARENT" }, select: { id: true } });
    const link = await db.studentGuardian.findFirst({ where: { studentId: koffi.student.id, isPrimary: true }, select: { guardianId: true, guardian: { select: { phone: true } } } });
    const colette = await db.user.create({
      data: {
        username: "colette.dossa",
        firstName: "Colette",
        lastName: "Dossa",
        gender: "F",
        phone: link?.guardian.phone ?? "0197450012",
        passwordHash: ctx.passwordHash,
        roleId: parentRole.id,
        scopeLevel: "SELF",
      },
      select: { id: true },
    });
    if (link) {
      await db.guardian.update({ where: { id: link.guardianId }, data: { firstName: "Colette", lastName: "Dossa", userId: colette.id, profession: "Infirmière" } });
      await db.studentGuardian.update({ where: { studentId_guardianId: { studentId: koffi.student.id, guardianId: link.guardianId } }, data: { relationship: "Mère" } });
    }
    const transfer = await db.studentTransfer.create({
      data: {
        studentId: koffi.student.id,
        kind: "SCHOOL_CHANGE",
        fromSchoolId: ceg,
        fromClassroomId: koffi.classroomId,
        toSchoolId: calavi.id,
        reason: "La famille déménage à Abomey-Calavi, près du nouveau poste de la mère.",
        shareHistory: true,
        status: "PENDING_GUARDIAN",
        requestedById: director,
        createdAt: at("2026-09-24T09:30:00Z"),
      },
      select: { id: true },
    });
    await db.notification.create({
      data: {
        userId: colette.id,
        kind: "transfer",
        title: `Transfert de ${first} : votre accord est demandé`,
        body: `CEG Godomey propose le transfert de ${first} Dossa vers CEG Abomey-Calavi. Répondez oui ou non.`,
        link: `/espace/transferts/${transfer.id}`,
        createdAt: at("2026-09-24T09:30:00Z"),
      },
    });
  }

  // 2. A school change waiting for CEG Godomey (incoming) --------------------
  // From CEG Abomey-Calavi; the father has no account and signed on paper.
  const [amos] = await firstPupils(db, calavi.id, yearId, "4e A", 1);
  const calaviDirector = await directorOf(db, calavi.id);
  if (amos && calaviDirector) {
    const guardian = await db.guardian.create({
      data: { firstName: "Gérard", lastName: amos.student.lastName, phone: "0196778812", profession: "Menuisier", preferredChannel: "VOICE_CALL", prefersAudio: true },
      select: { id: true },
    });
    await db.studentGuardian.create({ data: { studentId: amos.student.id, guardianId: guardian.id, relationship: "Père", isPrimary: true } });
    await addPhoto(db, calaviDirector, amos.student);
    const transfer = await db.studentTransfer.create({
      data: {
        studentId: amos.student.id,
        kind: "SCHOOL_CHANGE",
        fromSchoolId: calavi.id,
        fromClassroomId: amos.classroomId,
        toSchoolId: ceg,
        reason: "Le père travaille désormais à Godomey : l'élève fera le trajet avec lui.",
        shareHistory: true,
        status: "PENDING_DESTINATION",
        requestedById: calaviDirector,
        guardianDecisionById: calaviDirector,
        guardianDecidedAt: at("2026-09-23T10:00:00Z"),
        createdAt: at("2026-09-23T10:00:00Z"),
      },
      select: { id: true },
    });
    const name = `${amos.student.firstName} ${amos.student.lastName}`;
    await db.notification.createMany({
      data: (await admissionStaff(db, ceg)).map((userId) => ({
        userId,
        kind: "transfer",
        title: `Demande d'accueil : ${name}`,
        body: `CEG Abomey-Calavi demande l'accueil de ${name} (4e A). Choisissez sa classe ou refusez.`,
        link: `/espace/transferts/${transfer.id}`,
        createdAt: at("2026-09-23T10:00:00Z"),
      })),
    });
  }

  // 3. A school change accepted, with the history shared ---------------------
  // A 5e pupil of CEG Ouidah who joined CEG Godomey's 5e A on 21 September.
  const ouidah = await schoolByName(db, "CEG Ouidah");
  const [moved] = await firstPupils(db, ouidah.id, yearId, "5e A", 1);
  const godomey5 = await db.classroom.findFirst({ where: { schoolId: ceg, academicYearId: yearId, name: "5e A" }, select: { id: true } });
  const ouidahDirector = await directorOf(db, ouidah.id);
  if (moved && godomey5) {
    const requestedBy = ouidahDirector ?? director;
    const guardian = await db.guardian.create({
      data: { firstName: "Rachida", lastName: moved.student.lastName, phone: "0195334470", profession: "Commerçante", preferredChannel: "SMS" },
      select: { id: true },
    });
    await db.studentGuardian.create({ data: { studentId: moved.student.id, guardianId: guardian.id, relationship: "Mère", isPrimary: true } });
    await addPhoto(db, director, moved.student);
    const decidedAt = at("2026-09-21T11:00:00Z");
    await db.studentTransfer.create({
      data: {
        studentId: moved.student.id,
        kind: "SCHOOL_CHANGE",
        fromSchoolId: ouidah.id,
        fromClassroomId: moved.classroomId,
        toSchoolId: ceg,
        toClassroomId: godomey5.id,
        reason: "La famille s'installe à Godomey.",
        shareHistory: true,
        status: "ACCEPTED",
        requestedById: requestedBy,
        guardianDecisionById: requestedBy,
        guardianDecidedAt: at("2026-09-17T09:00:00Z"),
        decidedById: director,
        decidedAt,
        decisionNote: "Bienvenue au CEG Godomey.",
        createdAt: at("2026-09-16T15:00:00Z"),
      },
    });
    // The enrollment of the year follows the pupil (see
    // src/features/transfers/enrollment-move.ts).
    await db.enrollment.update({ where: { id: moved.id }, data: { schoolId: ceg, classroomId: godomey5.id, enrolledAt: decidedAt } });
    await db.studentRecordAccess.create({ data: { studentId: moved.student.id, schoolId: ceg, grantedById: director, createdAt: decidedAt } });
  }

  // 4. A class change inside CEG Godomey ------------------------------------
  const sixB = await db.classroom.findFirst({ where: { schoolId: ceg, academicYearId: yearId, name: "6e B" }, select: { id: true } });
  const [changer] = await firstPupils(db, ceg, yearId, "6e A", 1);
  if (changer && sixB) {
    const when = at("2026-09-18T08:00:00Z");
    await db.studentTransfer.create({
      data: {
        studentId: changer.student.id,
        kind: "CLASS_CHANGE",
        fromSchoolId: ceg,
        fromClassroomId: changer.classroomId,
        toSchoolId: ceg,
        toClassroomId: sixB.id,
        reason: "Équilibrage des effectifs entre les deux classes de 6e.",
        shareHistory: true,
        status: "ACCEPTED",
        requestedById: director,
        decidedById: director,
        decidedAt: when,
        createdAt: when,
      },
    });
    await db.enrollment.update({ where: { id: changer.id }, data: { classroomId: sixB.id } });
  }
}

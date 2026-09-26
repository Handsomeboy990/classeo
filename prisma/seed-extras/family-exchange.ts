import { createHash } from "node:crypto";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { initialsAvatarPng } from "../../src/features/students/avatar-png";

import type { SeedContext } from "./index";

// Demonstration data of the family exchange features: group conversations
// (one shared between staff, one private per parent), voice notes, the
// enrollment pieces CEG Godomey and EPP Godomey Centre ask for, pieces sent
// by parents (pending, validated, refused, a health piece whose file is
// gone), justified absences and an EPS dispensation. Fixed dates and
// values, so every run gives the same data.

const at = (iso: string) => new Date(iso);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// A one page PDF, small and valid, standing for a scanned piece.
function samplePdf(title: string) {
  const text = title.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET BT /F1 11 Tf 72 690 Td (Document de demonstration) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

// A short WAV clip (8 kHz, 16 bit, mono) standing for a recorded voice: a
// voiced sound whose pitch and loudness move like speech, in syllables
// separated by short pauses. Valid audio every browser plays.
export function sampleVoiceWav(seconds: number, seed: number) {
  const rate = 8000;
  const n = Math.round(seconds * rate);
  const data = Buffer.alloc(n * 2);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const syllable = (t * 3.2 + seed * 0.37) % 1;
    const envelope = syllable < 0.75 ? Math.sin((Math.PI * syllable) / 0.75) : 0;
    const pitch = 150 + 35 * Math.sin(2 * Math.PI * (0.7 + seed * 0.1) * t) + 20 * Math.sin(2 * Math.PI * 5 * t);
    phase += (2 * Math.PI * pitch) / rate;
    // A few harmonics give a vowel like timbre.
    const voice = Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase) + 0.12 * Math.sin(4 * phase);
    const fade = Math.min(1, t / 0.05, (seconds - t) / 0.05);
    data.writeInt16LE(Math.round(voice * envelope * fade * 7000), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function saveFile(db: PrismaClient, ownerUserId: string, purpose: string, fileName: string, mimeType: string, bytes: Uint8Array) {
  const data = new Uint8Array(bytes);
  const f = await db.fileBlob.create({
    data: { ownerUserId, purpose, fileName, mimeType, size: data.byteLength, sha256: createHash("sha256").update(data).digest("hex"), data },
    select: { id: true },
  });
  return f.id;
}

export async function seedFamilyExchange(db: PrismaClient, ctx: SeedContext) {
  const { ceg, epp } = ctx.schools;
  const { director, parent, teacher, student } = ctx.ids;
  const [secretary, colette, eppHead] = await Promise.all([
    db.user.findFirst({ where: { schoolId: ceg, role: { code: "SECRETARY" } }, select: { id: true } }),
    db.user.findUnique({ where: { username: "colette.dossa" }, select: { id: true, guardian: { select: { id: true } } } }),
    db.user.findFirst({ where: { schoolId: epp, role: { code: "SCHOOL_DIRECTOR" } }, orderBy: { username: "asc" }, select: { id: true } }),
  ]);
  const senami = await db.enrollment.findFirst({
    where: { academicYearId: ctx.yearId, student: { userId: student } },
    select: { id: true, studentId: true, classroomId: true, classroom: { select: { levelId: true } } },
  });
  const sibling = await db.enrollment.findFirst({
    where: { academicYearId: ctx.yearId, schoolId: epp, student: { guardians: { some: { guardian: { userId: parent } } } } },
    select: { id: true, studentId: true },
  });
  if (!secretary || !senami) throw new Error("family exchange seed: demo accounts missing");
  const colleague = await db.user.findFirst({
    where: { schoolId: ceg, role: { code: "TEACHER" }, id: { not: teacher }, teachers: { some: { assignments: { some: { classroomId: senami.classroomId } } } } },
    orderBy: { username: "asc" },
    select: { id: true },
  });

  // 1. Group conversations ----------------------------------------------------
  const conversation = async (subject: string, people: string[], lines: { from: string; body: string; at: Date; audio?: { seconds: number; seed: number } }[], readAt: Date) => {
    const c = await db.conversation.create({
      data: { subject, createdAt: lines[0]!.at, participants: { create: people.map((userId) => ({ userId, lastReadAt: readAt })) } },
      select: { id: true },
    });
    for (const l of lines) {
      const audioFileId = l.audio ? await saveFile(db, l.from, "voice_note", "message-vocal.wav", "audio/wav", sampleVoiceWav(l.audio.seconds, l.audio.seed)) : null;
      await db.message.create({ data: { conversationId: c.id, senderId: l.from, body: l.audio ? "" : l.body, createdAt: l.at, audioFileId, audioDurationMs: l.audio ? l.audio.seconds * 1000 : null } });
    }
    await db.conversation.update({ where: { id: c.id }, data: { updatedAt: lines[lines.length - 1]!.at } });
    return c.id;
  };

  // Staff only: one conversation where everyone reads everyone.
  await conversation(
    "Préparation du conseil de classe de la 3e A",
    [director, teacher, secretary.id, ...(colleague ? [colleague.id] : [])],
    [
      { from: director, body: "Bonjour à tous. Le conseil de classe de la 3e A se tiendra le vendredi 9 octobre à 15 h en salle des professeurs. Merci de saisir vos notes avant le mercredi 7.", at: at("2026-09-23T08:15:00Z") },
      { from: teacher, body: "Bien noté. Les notes de mathématiques seront saisies lundi.", at: at("2026-09-23T09:02:00Z") },
      { from: secretary.id, body: "Je prépare les fiches de synthèse pour le conseil, je vous les envoie jeudi.", at: at("2026-09-23T10:40:00Z") },
      ...(colleague ? [{ from: colleague.id, body: "Merci. Je serai là, avec les relevés de français.", at: at("2026-09-23T11:05:00Z") }] : []),
    ],
    at("2026-09-23T12:00:00Z"),
  );

  // To parents: the same message, one private conversation per family.
  const meeting = "Bonjour. La réunion des parents d'élèves de la 3e A aura lieu le samedi 3 octobre à 9 h dans la cour du collège. Nous parlerons de l'examen blanc et des cotisations. Votre présence est importante. Le chef d'établissement.";
  for (const [who, answer] of [
    [parent, "Merci, je serai présente."],
    [colette?.id, null],
  ] as const) {
    if (!who) continue;
    await conversation(
      "Réunion des parents d'élèves du 3 octobre",
      [director, who],
      [{ from: director, body: meeting, at: at("2026-09-24T16:00:00Z") }, ...(answer ? [{ from: who, body: answer, at: at("2026-09-24T19:12:00Z") }] : [])],
      at("2026-09-24T16:00:00Z"),
    );
  }

  // 2. Voice notes -----------------------------------------------------------
  await conversation(
    "Sortie pédagogique au jardin botanique",
    [teacher, parent],
    [
      { from: teacher, body: "Bonjour Madame Hounkpatin. La classe visite le jardin botanique de Porto-Novo le vendredi 2 octobre. Sènami peut-elle venir ? Il faut une autorisation signée.", at: at("2026-09-24T12:30:00Z") },
      { from: parent, body: "", at: at("2026-09-24T18:45:00Z"), audio: { seconds: 6, seed: 1 } },
      { from: teacher, body: "", at: at("2026-09-25T07:20:00Z"), audio: { seconds: 4, seed: 2 } },
    ],
    at("2026-09-25T07:20:00Z"),
  );

  // 3. Pieces the schools ask for at enrollment ------------------------------
  const pieces = async (schoolId: string, list: { label: string; description?: string; isHealth?: boolean; levelId?: string | null }[]) => {
    const out: Record<string, string> = {};
    for (const [i, p] of list.entries()) {
      const row = await db.requiredPiece.create({ data: { schoolId, label: p.label, description: p.description ?? null, isHealth: p.isHealth ?? false, levelId: p.levelId ?? null, sortOrder: i, createdAt: at("2026-09-01T08:00:00Z") }, select: { id: true } });
      out[p.label] = row.id;
    }
    return out;
  };
  const cegPieces = await pieces(ceg, [
    { label: "Copie de l'acte de naissance", description: "Copie légalisée ou copie sécurisée." },
    { label: "Deux photos d'identité", description: "Récentes, sur fond clair." },
    { label: "Bulletins de l'année précédente", description: "Les bulletins des trois trimestres." },
    { label: "Carnet de vaccination", description: "Les pages des vaccins suffisent.", isHealth: true },
    { label: "Fiche d'engagement disciplinaire", description: "Signée par le parent et légalisée." },
    { label: "Fiche de renseignements pour le BEPC", description: "Remplie et signée par le parent.", levelId: senami.classroom.levelId },
  ]);
  await pieces(epp, [
    { label: "Copie de l'acte de naissance", description: "Copie légalisée ou copie sécurisée." },
    { label: "Deux photos d'identité" },
    { label: "Carnet de vaccination", isHealth: true },
  ]);

  // 4. Pieces sent by the demo parent for Sènami ------------------------------
  const base = { studentId: senami.studentId, enrollmentId: senami.id, schoolId: ceg, submittedById: parent };
  const acte = await saveFile(db, parent, "family_document", "acte-de-naissance.pdf", "application/pdf", samplePdf("Copie de l'acte de naissance"));
  await db.familyDocument.create({
    data: { ...base, kind: "ENROLLMENT", requiredPieceId: cegPieces["Copie de l'acte de naissance"], fileId: acte, status: "ACCEPTED", reviewedById: secretary.id, reviewedAt: at("2026-09-16T10:00:00Z"), createdAt: at("2026-09-14T19:30:00Z") },
  });
  const photo = await saveFile(db, parent, "family_document", "photos-identite.png", "image/png", initialsAvatarPng("Sènami", "Hounkpatin", 320));
  const pendingPhoto = await db.familyDocument.create({
    data: { ...base, kind: "ENROLLMENT", requiredPieceId: cegPieces["Deux photos d'identité"], fileId: photo, note: "Les photos papier sont aussi dans son cahier.", createdAt: at("2026-09-25T20:10:00Z") },
    select: { id: true },
  });
  const bulletin = await saveFile(db, parent, "family_document", "bulletin-2e-trimestre.pdf", "application/pdf", samplePdf("Bulletin du 2e trimestre 2025-2026"));
  await db.familyDocument.create({
    data: {
      ...base,
      kind: "ENROLLMENT",
      requiredPieceId: cegPieces["Bulletins de l'année précédente"],
      fileId: bulletin,
      status: "REJECTED",
      reviewedById: secretary.id,
      reviewedAt: at("2026-09-22T11:00:00Z"),
      reviewNote: "Il manque les bulletins du 1er et du 3e trimestre. Envoyez les trois, dans un seul PDF ou en photos.",
      createdAt: at("2026-09-21T18:00:00Z"),
    },
  });
  // A health piece: checked, then its file deleted; only the decision stays.
  await db.familyDocument.create({
    data: { ...base, kind: "ENROLLMENT", requiredPieceId: cegPieces["Carnet de vaccination"], status: "ACCEPTED", reviewedById: director, reviewedAt: at("2026-09-17T09:00:00Z"), fileRemovedAt: at("2026-09-17T09:00:00Z"), createdAt: at("2026-09-15T20:00:00Z") },
  });

  // 5. Absences: the one the teacher asked about, justified and excused; three
  // afternoons more, one justification waiting, two still to justify.
  const absence = await db.studentAttendance.findFirst({ where: { enrollmentId: senami.id, status: "ABSENT", half: "MORNING", reason: null }, orderBy: { date: "desc" }, select: { id: true } });
  if (absence) {
    await db.studentAttendance.update({ where: { id: absence.id }, data: { status: "EXCUSED", reason: "Justifiée : elle avait de la fièvre, elle est restée à la maison." } });
    await db.familyDocument.create({
      data: { ...base, kind: "ABSENCE", attendanceId: absence.id, note: "Elle avait de la fièvre, elle est restée à la maison.", status: "ACCEPTED", reviewedById: secretary.id, reviewedAt: at("2026-09-25T08:30:00Z"), createdAt: at("2026-09-24T19:40:00Z") },
    });
  }
  const afternoons = ["2026-09-16", "2026-09-17", "2026-09-22"];
  for (const [i, iso] of afternoons.entries()) {
    const row = await db.studentAttendance.update({
      where: { enrollmentId_date_half: { enrollmentId: senami.id, date: day(iso), half: "AFTERNOON" } },
      data: { status: "ABSENT", reason: null },
      select: { id: true },
    });
    if (i === 0) {
      const note = await saveFile(db, parent, "family_document", "convocation-hopital.pdf", "application/pdf", samplePdf("Convocation au centre de sante de Godomey"));
      await db.familyDocument.create({ data: { ...base, kind: "ABSENCE", attendanceId: row.id, fileId: note, note: "Rendez-vous au centre de santé de Godomey.", createdAt: at("2026-09-25T21:00:00Z") } });
    }
  }

  // 6. An EPS dispensation, accepted: the certificate is gone, the period stays.
  await db.familyDocument.create({
    data: { ...base, kind: "MEDICAL", startsOn: day("2026-09-21"), endsOn: day("2026-10-16"), status: "ACCEPTED", reviewedById: director, reviewedAt: at("2026-09-21T10:15:00Z"), fileRemovedAt: at("2026-09-21T10:15:00Z"), createdAt: at("2026-09-20T18:00:00Z") },
  });

  // 7. Another family: Colette Dossa sends her child's birth certificate.
  if (colette?.guardian) {
    const child = await db.enrollment.findFirst({ where: { academicYearId: ctx.yearId, schoolId: ceg, student: { guardians: { some: { guardianId: colette.guardian.id } } } }, select: { id: true, studentId: true } });
    if (child) {
      const file = await saveFile(db, colette.id, "family_document", "acte-naissance.pdf", "application/pdf", samplePdf("Copie de l'acte de naissance"));
      await db.familyDocument.create({ data: { kind: "ENROLLMENT", studentId: child.studentId, enrollmentId: child.id, schoolId: ceg, submittedById: colette.id, requiredPieceId: cegPieces["Copie de l'acte de naissance"], fileId: file, createdAt: at("2026-09-25T17:45:00Z") } });
    }
  }

  // 8. The sibling at EPP Godomey Centre: the vaccination record waits for
  // the head of school.
  if (sibling && eppHead) {
    const eppVaccination = await db.requiredPiece.findFirst({ where: { schoolId: epp, label: "Carnet de vaccination" }, select: { id: true } });
    const file = await saveFile(db, parent, "family_document", "carnet-vaccination.pdf", "application/pdf", samplePdf("Carnet de vaccination"));
    await db.familyDocument.create({ data: { kind: "ENROLLMENT", studentId: sibling.studentId, enrollmentId: sibling.id, schoolId: epp, submittedById: parent, requiredPieceId: eppVaccination?.id ?? null, fileId: file, createdAt: at("2026-09-24T20:00:00Z") } });
  }

  // 9. Notifications behind the menu badges.
  await db.notification.createMany({
    data: [
      { userId: secretary.id, kind: "family_document", title: "Pièce d'inscription à examiner", body: "Sènami Hounkpatin, 3e A : Deux photos d'identité.", link: `/espace/pieces-familles/${pendingPhoto.id}`, createdAt: at("2026-09-25T20:10:00Z") },
      { userId: director, kind: "family_document", title: "Pièce d'inscription à examiner", body: "Sènami Hounkpatin, 3e A : Deux photos d'identité.", link: `/espace/pieces-familles/${pendingPhoto.id}`, createdAt: at("2026-09-25T20:10:00Z") },
      { userId: parent, kind: "family_document", title: "Bulletins de l'année précédente refusée", body: "Sènami Hounkpatin : il manque les bulletins du 1er et du 3e trimestre.", link: `/espace/pieces-justificatifs?enfant=${senami.studentId}`, createdAt: at("2026-09-22T11:00:00Z") },
    ],
  });
}

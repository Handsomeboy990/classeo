import { createHash } from "node:crypto";

import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// Governance demonstration data: a closed previous year with one extension
// running and one requested, subject proposals, a suspended school, document
// requests and the payment accounts of CEG Godomey. Fixed dates and values,
// so every run gives the same data.

// A one page PDF, small and valid, standing for a scanned report.
function samplePdf(title: string) {
  const text = title.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
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

export async function seedGovernance(db: PrismaClient, ctx: SeedContext) {
  const prevYear = await db.academicYear.findUnique({ where: { label: "2025-2026" }, select: { id: true } });
  if (!prevYear) throw new Error("governance seed: year 2025-2026 missing");
  const [inspector, departmentDirector] = await Promise.all([
    db.user.findUnique({ where: { username: "benedicta.zannou" }, select: { id: true } }),
    db.user.findUnique({ where: { username: "aristide.gbaguidi" }, select: { id: true } }),
  ]);
  if (!inspector || !departmentDirector) throw new Error("governance seed: territory demo accounts missing");
  const eppHead = await db.user.findFirst({ where: { schoolId: ctx.schools.epp, role: { code: "SCHOOL_DIRECTOR" } }, orderBy: { username: "asc" }, select: { id: true } });

  // 1. The previous year is closed by the ministry a week after its end.
  await db.academicYear.update({ where: { id: prevYear.id }, data: { closedAt: new Date("2026-07-10T08:00:00Z") } });

  // 2. EPP Godomey Centre may still complete 2025-2026 until mid October.
  const eppRequest = await db.schoolRequest.create({
    data: {
      schoolId: ctx.schools.epp,
      type: "YEAR_EXTENSION",
      subject: "Prolongation 2025-2026 pour la saisie des notes du 3e trimestre",
      body: "Deux enseignants étaient absents en fin d'année : les compositions du 3e trimestre de trois classes n'ont pas été saisies. Nous demandons trois semaines pour terminer.\n\nDate souhaitée : 16 octobre 2026.",
      status: "APPROVED",
      authorId: eppHead?.id ?? ctx.ids.director,
      deciderId: ctx.ids.minister,
      decidedAt: new Date("2026-09-15T09:30:00Z"),
      decisionNote: "Accordé jusqu'au 16 octobre 2026 pour la saisie des compositions manquantes.",
      createdAt: new Date("2026-09-11T10:00:00Z"),
    },
    select: { id: true },
  });
  await db.yearExtension.create({
    data: {
      academicYearId: prevYear.id,
      schoolId: ctx.schools.epp,
      until: new Date("2026-10-16T22:59:59.999Z"),
      reason: "Saisie des compositions du 3e trimestre restées en attente.",
      grantedById: ctx.ids.minister,
      requestId: eppRequest.id,
      createdAt: new Date("2026-09-15T09:30:00Z"),
    },
  });

  // 3. CEG Godomey asks for an extension too; the ministry has not decided.
  await db.schoolRequest.create({
    data: {
      schoolId: ctx.schools.ceg,
      type: "YEAR_EXTENSION",
      subject: "Prolongation 2025-2026 pour publier les bulletins de la 3e A",
      body: "Les bulletins du 3e trimestre de la 3e A n'ont pas pu être publiés avant la clôture : une note de composition a été contestée puis corrigée. Nous avons besoin d'une semaine.\n\nDate souhaitée : 9 octobre 2026.",
      authorId: ctx.ids.director,
      createdAt: new Date("2026-09-22T08:15:00Z"),
    },
  });

  // 4. Two subjects proposed by schools, waiting for the ministry.
  const other = await db.school.findFirst({
    where: { id: { notIn: [ctx.schools.ceg, ctx.schools.epp] }, cycle: "SECONDARY", commune: { department: { name: "Atlantique" } } },
    orderBy: { code: "asc" },
    select: { id: true },
  });
  await db.subject.createMany({
    data: [
      { code: "INFO", name: "Informatique", status: "PENDING", requestedBySchoolId: ctx.schools.ceg },
      { code: "ENTR", name: "Entrepreneuriat", status: "PENDING", requestedBySchoolId: other?.id ?? ctx.schools.epp },
    ],
  });

  // 5. A school of Toffo (Atlantique) is suspended. Not in Abomey-Calavi,
  // whose schools carry the teacher switch, transfer and mock exam demos,
  // nor CEG Allada, the partner school of the messaging demo.
  const suspended =
    (await db.school.findFirst({ where: { id: { notIn: [ctx.schools.ceg, ctx.schools.epp] }, commune: { name: "Toffo" } }, orderBy: { code: "asc" }, select: { id: true } })) ??
    (await db.school.findFirst({ where: { id: { notIn: [ctx.schools.ceg, ctx.schools.epp] } }, orderBy: { code: "asc" }, select: { id: true } }));
  if (suspended)
    await db.school.update({
      where: { id: suspended.id },
      data: {
        status: "SUSPENDED",
        isActive: false,
        statusReason: "Bâtiments jugés dangereux par la commission de sécurité du 18 septembre 2026, en attente des travaux.",
        statusChangedAt: new Date("2026-09-19T09:00:00Z"),
      },
    });

  // 6. Document requests to CEG Godomey: one waiting, one answered.
  await db.documentRequest.create({
    data: {
      schoolId: ctx.schools.ceg,
      title: "Rapport de rentrée 2026-2027",
      description: "Effectifs par classe, enseignants en poste et besoins en salles, signés par le chef d'établissement.",
      dueDate: new Date("2026-10-09T00:00:00Z"),
      requestedById: inspector.id,
      createdAt: new Date("2026-09-21T08:00:00Z"),
    },
  });
  const pdf = samplePdf("Inventaire du mobilier scolaire, CEG Godomey, septembre 2026");
  const director = ctx.ids.director;
  await db.documentRequest.create({
    data: {
      schoolId: ctx.schools.ceg,
      title: "Inventaire du mobilier scolaire",
      description: "Nombre de tables-bancs, tableaux et armoires par salle, avec leur état.",
      dueDate: new Date("2026-09-30T00:00:00Z"),
      requestedById: departmentDirector.id,
      status: "SUBMITTED",
      createdAt: new Date("2026-09-16T10:00:00Z"),
      files: {
        create: {
          uploadedById: director,
          createdAt: new Date("2026-09-24T15:20:00Z"),
          file: {
            create: {
              ownerUserId: director,
              purpose: "document",
              fileName: "inventaire-mobilier-ceg-godomey.pdf",
              mimeType: "application/pdf",
              size: pdf.byteLength,
              sha256: createHash("sha256").update(pdf).digest("hex"),
              data: pdf,
            },
          },
        },
      },
    },
  });

  // 7. Where parents pay CEG Godomey, and the school's identity.
  await db.school.update({
    where: { id: ctx.schools.ceg },
    data: { motto: "Travail, Discipline, Réussite", postalBox: "01 BP 4521 Abomey-Calavi", address: "Carrefour Godomey, route de Pahou" },
  });
  await db.schoolPaymentAccount.createMany({
    data: [
      {
        schoolId: ctx.schools.ceg,
        channel: "MOBILE_MONEY",
        provider: "MTN MoMo",
        accountName: "CEG Godomey",
        accountNumber: "+229 01 97 45 12 30",
        instructions: "Indiquez le matricule de l'élève en motif du transfert.",
        createdAt: new Date("2026-09-01T08:00:00Z"),
      },
      {
        schoolId: ctx.schools.ceg,
        channel: "BANK",
        provider: "Ecobank Bénin",
        accountName: "CEG Godomey, frais scolaires",
        accountNumber: "BJ66BJ0100100100123456789012",
        instructions: "Virement ou versement au guichet, avec le nom et le matricule de l'élève.",
        createdAt: new Date("2026-09-01T08:05:00Z"),
      },
    ],
  });
}

import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// What the past years left beside the marks (prisma/seed-history writes the
// pupils, results, attendance, fees and timetables): requests up the chain
// and their decisions, year extensions, document requests, announcements
// and resources, conversations, notifications, the register of issued
// documents, the pieces families sent, and the activity log. Fixed dates,
// one seeded generator.

function generator(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 2 ** 32;
  };
}

const at = (iso: string) => new Date(iso);

// A one page PDF, small and valid, standing for a scanned document.
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

export async function seedHistoryExtras(db: PrismaClient, ctx: SeedContext) {
  const rand = generator(20230911);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const { ceg, epp } = ctx.schools;
  const { minister, director, accountant, parent, teacher } = ctx.ids;
  const byName = async (username: string) => (await db.user.findUnique({ where: { username }, select: { id: true } }))?.id ?? minister;
  const [ddestfp, ddemp, inspector, secretary, eppHead] = await Promise.all([
    byName("aristide.gbaguidi"),
    byName("clarisse.akpovi"),
    byName("benedicta.zannou"),
    byName("pelagie.tossou"),
    db.user.findFirst({ where: { schoolId: epp, role: { code: "SCHOOL_DIRECTOR" } }, orderBy: { username: "asc" }, select: { id: true } }).then((u) => u?.id ?? director),
  ]);
  const years = await db.academicYear.findMany({ where: { isActive: false }, orderBy: { startDate: "asc" }, select: { id: true, label: true, startDate: true, endDate: true, closedAt: true } });
  const yearOf = (label: string) => years.find((y) => y.label === label)!;
  const saveFile = async (ownerUserId: string, fileName: string, title: string, createdAt: Date) => {
    const data = samplePdf(title);
    const f = await db.fileBlob.create({
      data: { ownerUserId, purpose: "document", fileName, mimeType: "application/pdf", size: data.byteLength, sha256: createHash("sha256").update(data).digest("hex"), data: new Uint8Array(data), createdAt },
      select: { id: true },
    });
    return f.id;
  };

  // 1. Requests up the chain, and year extensions -----------------------------
  type Req = { schoolId: string; type: "YEAR_EXTENSION" | "NEW_SUBJECT" | "STAFFING" | "INFRASTRUCTURE" | "OTHER"; subject: string; body: string; author: string; createdAt: string; status: "APPROVED" | "REJECTED"; decider: string; decidedAt: string; note: string };
  const requests: Req[] = [
    {
      schoolId: ceg,
      type: "INFRASTRUCTURE",
      subject: "Construction de deux blocs de latrines",
      body: "Le collège compte plus de 250 élèves pour quatre cabines de latrines, dont deux hors d'usage. Nous demandons la construction de deux blocs, un pour les filles et un pour les garçons.",
      author: director,
      createdAt: "2022-10-04T09:00:00Z",
      status: "APPROVED",
      decider: ddestfp,
      decidedAt: "2022-11-18T10:30:00Z",
      note: "Accordé. Les travaux sont inscrits au programme d'investissement 2023 ; la mairie d'Abomey-Calavi en assure la maîtrise d'ouvrage.",
    },
    {
      schoolId: ceg,
      type: "STAFFING",
      subject: "Affectation d'un professeur de physique, chimie et technologie",
      body: "Notre unique professeur de PCT a été muté en août. Les quatre classes n'ont plus de cours de PCT depuis la rentrée.",
      author: director,
      createdAt: "2023-09-19T08:30:00Z",
      status: "APPROVED",
      decider: ddestfp,
      decidedAt: "2023-10-06T11:00:00Z",
      note: "Un professeur de PCT est affecté au CEG Godomey à compter du lundi 16 octobre 2023.",
    },
    {
      schoolId: ceg,
      type: "OTHER",
      subject: "Ouverture du second cycle : une classe de 2nde C à la rentrée 2024",
      body: "Nos élèves de 3e doivent aller jusqu'à Abomey-Calavi centre pour entrer en seconde. Une salle neuve est disponible et deux professeurs certifiés peuvent prendre les mathématiques et la PCT. Nous demandons l'ouverture d'une 2nde C, puis d'une 1ère D et d'une Tle D les années suivantes.",
      author: director,
      createdAt: "2024-02-12T09:15:00Z",
      status: "APPROVED",
      decider: ddestfp,
      decidedAt: "2024-04-22T10:00:00Z",
      note: "Accordé : ouverture de la 2nde C à la rentrée 2024-2025, puis d'une classe par an jusqu'à la terminale.",
    },
    {
      schoolId: ceg,
      type: "NEW_SUBJECT",
      subject: "Proposition de matière : Robotique",
      body: "Un club de robotique fonctionne depuis deux ans avec l'appui d'une ONG. Nous proposons d'en faire une matière optionnelle en 4e et en 3e.",
      author: director,
      createdAt: "2024-11-05T10:00:00Z",
      status: "REJECTED",
      decider: minister,
      decidedAt: "2025-01-20T09:00:00Z",
      note: "Refusé comme matière : le programme national ne la prévoit pas. Le club peut continuer comme activité parascolaire.",
    },
    {
      schoolId: ceg,
      type: "YEAR_EXTENSION",
      subject: "Prolongation 2024-2025 pour la saisie des notes de la 2nde C",
      body: "Le professeur de SVT de la 2nde C a été hospitalisé en juin : les notes du second semestre n'ont pas pu être saisies avant la clôture. Nous demandons deux semaines.\n\nDate souhaitée : 25 juillet 2025.",
      author: director,
      createdAt: "2025-07-08T08:40:00Z",
      status: "APPROVED",
      decider: minister,
      decidedAt: "2025-07-09T15:00:00Z",
      note: "Accordé jusqu'au 25 juillet 2025.",
    },
    {
      schoolId: epp,
      type: "INFRASTRUCTURE",
      subject: "Réhabilitation du puits de l'école",
      body: "Le puits est à sec depuis mars : les élèves n'ont plus d'eau pour boire ni pour la cantine. Nous demandons un forage ou la réhabilitation du puits.",
      author: eppHead,
      createdAt: "2024-03-11T09:00:00Z",
      status: "APPROVED",
      decider: ddemp,
      decidedAt: "2024-05-02T10:00:00Z",
      note: "Accordé : un forage est réalisé pendant les vacances avec l'appui de la commune.",
    },
    {
      schoolId: epp,
      type: "STAFFING",
      subject: "Un enseignant pour la classe de CP",
      body: "Avec 58 élèves inscrits en CP, la classe est tenue par un enseignant communautaire. Nous demandons un enseignant titulaire.",
      author: eppHead,
      createdAt: "2023-09-25T08:00:00Z",
      status: "REJECTED",
      decider: ddemp,
      decidedAt: "2023-11-10T09:00:00Z",
      note: "Aucun poste disponible cette année. La demande est gardée pour le mouvement de 2024.",
    },
  ];
  const created = [];
  for (const r of requests)
    created.push(
      await db.schoolRequest.create({
        data: { schoolId: r.schoolId, type: r.type, subject: r.subject, body: r.body, authorId: r.author, createdAt: at(r.createdAt), status: r.status, deciderId: r.decider, decidedAt: at(r.decidedAt), decisionNote: r.note },
        select: { id: true, type: true, status: true },
      }),
    );
  const extension = created[4]!;
  await db.yearExtension.create({
    data: { academicYearId: yearOf("2024-2025").id, schoolId: ceg, until: at("2025-07-25T22:59:59.999Z"), reason: "Saisie des notes du second semestre de la 2nde C.", status: "ENDED", grantedById: minister, requestId: extension.id, createdAt: at("2025-07-09T15:00:00Z") },
  });
  await db.subject.create({ data: { code: "ROBO", name: "Robotique", status: "REJECTED", requestedBySchoolId: ceg, decisionNote: requests[3]!.note } });

  // 2. Documents the chain asked for, answered ---------------------------------
  const docs: { schoolId: string; title: string; description: string; by: string; asked: string; due: string; answered: string; reviewed: string; uploader: string }[] = [];
  for (const y of years) {
    const s = y.label.slice(0, 4);
    docs.push(
      { schoolId: ceg, title: `Rapport de rentrée ${y.label}`, description: "Effectifs par classe, enseignants en poste et besoins en salles, signés par le chef d'établissement.", by: ddestfp, asked: `${s}-09-20T08:00:00Z`, due: `${s}-10-10T00:00:00Z`, answered: `${s}-10-06T15:00:00Z`, reviewed: `${s}-10-12T09:00:00Z`, uploader: director },
      { schoolId: epp, title: `Rapport de rentrée ${y.label}`, description: "Effectifs par classe et par sexe, enseignants en poste, état des salles.", by: inspector, asked: `${s}-09-21T08:00:00Z`, due: `${s}-10-10T00:00:00Z`, answered: `${s}-10-08T11:00:00Z`, reviewed: `${s}-10-13T10:00:00Z`, uploader: eppHead },
      { schoolId: ceg, title: `Statistiques de fin d'année ${y.label}`, description: "Résultats par classe, taux de passage et de redoublement, résultats au BEPC.", by: ddestfp, asked: `${Number(s) + 1}-06-02T08:00:00Z`, due: `${Number(s) + 1}-07-15T00:00:00Z`, answered: `${Number(s) + 1}-07-09T16:00:00Z`, reviewed: `${Number(s) + 1}-07-16T09:00:00Z`, uploader: director },
    );
  }
  for (const d of docs) {
    const fileId = await saveFile(d.uploader, `${d.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf`, d.title, at(d.answered));
    await db.documentRequest.create({
      data: {
        schoolId: d.schoolId,
        title: d.title,
        description: d.description,
        dueDate: at(d.due),
        requestedById: d.by,
        status: "ACCEPTED",
        reviewedById: d.by,
        reviewedAt: at(d.reviewed),
        createdAt: at(d.asked),
        files: { create: { fileId, uploadedById: d.uploader, createdAt: at(d.answered) } },
      },
    });
  }

  // 3. Announcements and resources of the past years ----------------------------
  // Announcements to families are archived once their year is closed; those
  // for the staff and the pupils' resources stay published.
  const passRate = async (yearId: string) => {
    const rows = await db.classCouncilDecision.groupBy({ by: ["decision"], where: { enrollment: { schoolId: ceg, academicYearId: yearId } }, _count: { _all: true } });
    const total = rows.reduce((a, r) => a + r._count._all, 0);
    const promoted = rows.find((r) => r.decision === "PROMOTED")?._count._all ?? 0;
    return total ? Math.round((100 * promoted) / total) : null;
  };
  const contents: Prisma.ContentCreateManyInput[] = [];
  const RESOURCES = [
    { title: "Fiche de révision : les fractions", body: "Simplifier, comparer et additionner des fractions, avec six exercices corrigés.", subject: "Mathématiques" },
    { title: "Fiche de révision : le théorème de Pythagore", body: "Énoncé, réciproque et exemples de calcul d'une longueur dans un triangle rectangle.", subject: "Mathématiques" },
    { title: "Annales corrigées de l'examen blanc de mathématiques", body: "Le sujet de mathématiques de l'examen blanc départemental, avec un corrigé détaillé et un barème.", subject: "Mathématiques" },
    { title: "Fiche de révision : les équations du premier degré", body: "Résoudre une équation, mettre un problème en équation, vérifier la solution.", subject: "Mathématiques" },
  ];
  for (const [i, y] of years.entries()) {
    const s = Number(y.label.slice(0, 4));
    const rate = await passRate(y.id);
    contents.push(
      {
        type: "ANNOUNCEMENT",
        title: `Rentrée scolaire ${y.label}`,
        easyRead: `L'école reprend le ${y.startDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })}.`,
        body: `Le ministère informe les parents, les élèves et les enseignants que la rentrée scolaire ${y.label} aura lieu le ${y.startDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} sur toute l'étendue du territoire national.`,
        audience: "EVERYONE",
        status: "ARCHIVED",
        publishedAt: new Date(y.startDate.getTime() - 5 * 86_400_000 + 9 * 3600_000),
        authorId: minister,
        createdAt: new Date(y.startDate.getTime() - 6 * 86_400_000),
      },
      {
        type: "ANNOUNCEMENT",
        title: `Calendrier des examens du CEP et du BEPC ${s + 1}`,
        easyRead: "Le CEP et le BEPC ont lieu en juin. Les dates exactes sont dans l'annonce.",
        body: `Les épreuves écrites du CEP ${s + 1} auront lieu dans la première quinzaine de juin, celles du BEPC dans la seconde. Les chefs d'établissement vérifient les listes de candidats avant le 28 février.`,
        audience: "EVERYONE",
        status: "ARCHIVED",
        publishedAt: at(`${s + 1}-01-20T10:00:00Z`),
        authorId: minister,
        createdAt: at(`${s + 1}-01-19T16:00:00Z`),
      },
      {
        type: "ANNOUNCEMENT",
        title: `Conférence pédagogique de rentrée ${y.label}`,
        body: `La direction départementale des enseignements secondaire, technique et de la formation professionnelle de l'Atlantique réunit les professeurs du premier cycle le premier samedi d'octobre ${s}, à Allada.`,
        audience: "TEACHERS",
        status: "PUBLISHED",
        publishedAt: at(`${s}-09-22T08:00:00Z`),
        departmentId: (await db.department.findUnique({ where: { name: "Atlantique" }, select: { id: true } }))!.id,
        authorId: ddestfp,
        createdAt: at(`${s}-09-21T17:00:00Z`),
      },
      {
        type: "EVENT",
        title: `Réunion des parents d'élèves, rentrée ${y.label}`,
        body: "Le chef d'établissement invite tous les parents d'élèves à la réunion de rentrée dans la cour du collège : organisation de l'année, cotisations, élection du bureau de l'association des parents.",
        audience: "PARENTS",
        status: "ARCHIVED",
        publishedAt: at(`${s}-09-25T12:00:00Z`),
        eventDate: at(`${s}-10-07T09:00:00Z`),
        schoolId: ceg,
        authorId: director,
        createdAt: at(`${s}-09-25T11:00:00Z`),
      },
      {
        type: "ANNOUNCEMENT",
        title: `Bilan de fin d'année ${y.label}`,
        body: `Le conseil des professeurs a arrêté les décisions de fin d'année. ${rate === null ? "" : `${rate} % des élèves passent en classe supérieure. `}Les dossiers des redoublants sont à revoir avec les professeurs principaux avant la rentrée.`,
        audience: "STAFF",
        status: "PUBLISHED",
        publishedAt: new Date(y.endDate.getTime() + 5 * 86_400_000 + 10 * 3600_000),
        schoolId: ceg,
        authorId: director,
        createdAt: new Date(y.endDate.getTime() + 5 * 86_400_000),
      },
      {
        type: "RESOURCE",
        title: RESOURCES[i % RESOURCES.length]!.title,
        body: RESOURCES[i % RESOURCES.length]!.body,
        subjectLabel: RESOURCES[i % RESOURCES.length]!.subject,
        audience: "STUDENTS",
        mediaType: "DOCUMENT",
        status: "PUBLISHED",
        publishedAt: at(`${s + 1}-02-${10 + i}T15:00:00Z`),
        schoolId: ceg,
        authorId: teacher,
        createdAt: at(`${s + 1}-02-${10 + i}T14:00:00Z`),
      },
    );
  }
  await db.content.createMany({ data: contents });

  // 4. Conversations of the past years ------------------------------------------
  const conversation = async (subject: string, people: string[], lines: { from: string; body: string; at: string }[]) => {
    const last = at(lines[lines.length - 1]!.at);
    await db.conversation.create({
      data: {
        subject,
        createdAt: at(lines[0]!.at),
        updatedAt: last,
        participants: { create: people.map((userId) => ({ userId, lastReadAt: last })) },
        messages: { create: lines.map((l) => ({ senderId: l.from, body: l.body, createdAt: at(l.at) })) },
      },
    });
  };
  await conversation("Effectifs de CI à la rentrée 2023", [minister, ddemp], [
    { from: minister, body: "Bonjour. Pouvez-vous me donner les effectifs de CI de l'Atlantique à la rentrée, comparés à ceux de l'an dernier ?", at: "2023-10-09T09:00:00Z" },
    { from: ddemp, body: "Bonjour Madame la Ministre. Les effectifs de CI progressent d'environ 4 % dans le département, davantage à Abomey-Calavi. Le détail par école est dans Classéo.", at: "2023-10-10T15:20:00Z" },
  ]);
  await conversation("Ouverture de la classe de 2nde C", [ddestfp, director], [
    { from: ddestfp, body: "Bonjour Monsieur le Directeur. Votre demande d'ouverture d'une 2nde C est accordée pour la rentrée 2024. Merci de me confirmer la salle et les professeurs prévus.", at: "2024-04-22T10:05:00Z" },
    { from: director, body: "Merci Monsieur le Directeur départemental. La salle du nouveau bâtiment est prête ; les mathématiques et la PCT seront assurées par deux professeurs certifiés déjà en poste.", at: "2024-04-23T08:40:00Z" },
    { from: ddestfp, body: "Parfait. Pensez à inscrire la classe dans Classéo avant la rentrée pour les affectations d'élèves.", at: "2024-04-23T11:15:00Z" },
  ]);
  await conversation("Conseil de classe de fin d'année de la 4e A", [director, teacher, secretary], [
    { from: director, body: "Bonjour. Le conseil de classe de fin d'année de la 4e A se tiendra le lundi 30 juin à 9 h. Les moyennes annuelles sont calculées dans Classéo.", at: "2026-06-24T08:00:00Z" },
    { from: teacher, body: "Bien noté. Les notes de mathématiques du second semestre sont toutes saisies.", at: "2026-06-24T10:12:00Z" },
    { from: secretary, body: "Les fiches de synthèse seront imprimées vendredi.", at: "2026-06-24T11:30:00Z" },
  ]);
  await conversation("Résultats du premier semestre", [teacher, parent], [
    { from: teacher, body: "Bonjour Madame. Les résultats du premier semestre sont en ligne. En mathématiques, votre fille progresse bien ; elle doit continuer à faire ses exercices chaque soir.", at: "2026-02-27T16:30:00Z" },
    { from: parent, body: "Merci Madame. Nous continuons à la maison.", at: "2026-02-27T19:05:00Z" },
  ]);
  await conversation("Forage de l'école", [ddemp, eppHead], [
    { from: ddemp, body: "Bonjour. Le forage de l'EPP Godomey Centre est programmé pendant les vacances. L'entreprise passera voir le terrain le 15 juillet.", at: "2024-07-02T09:00:00Z" },
    { from: eppHead, body: "Merci Madame la Directrice départementale. Je serai présente pour les accueillir.", at: "2024-07-02T12:40:00Z" },
  ]);

  // 5. Notifications of the past years, read ------------------------------------
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  for (const label of ["2023-2024", "2024-2025"]) {
    const y = yearOf(label);
    const when = new Date(y.endDate.getTime() + 14 * 86_400_000 + 9 * 3600_000);
    notifications.push({ userId: parent, kind: "report_card", title: "Bulletin disponible", body: `Le bulletin du second semestre ${label} de Sènami est disponible.`, link: "/espace/suivi", readAt: new Date(when.getTime() + 8 * 3600_000), createdAt: when });
  }
  for (const [i, r] of requests.entries()) {
    const author = r.author;
    notifications.push({ userId: author, kind: "request", title: r.status === "APPROVED" ? "Demande accordée" : "Demande refusée", body: r.subject, link: `/espace/demandes/${created[i]!.id}`, readAt: at(r.decidedAt), createdAt: at(r.decidedAt) });
  }
  await db.notification.createMany({ data: notifications });

  // 6. The register of documents issued in the past years (CEG Godomey) ------
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const code = () => {
    let s = "";
    for (let i = 0; i < 10; i++) s += ALPHABET[Math.floor(rand() * 32)];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  };
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const issued: Prisma.IssuedDocumentCreateManyInput[] = [];
  for (const y of years) {
    const pupils = await db.enrollment.findMany({ where: { schoolId: ceg, academicYearId: y.id, status: "ACTIVE" }, select: { id: true, studentId: true, reportCards: { select: { id: true, publishedAt: true }, orderBy: { publishedAt: "asc" } } }, orderBy: { id: "asc" }, take: 40 });
    for (const [i, p] of pupils.entries()) {
      if (i < 12) {
        const when = new Date(y.startDate.getTime() + (10 + i) * 86_400_000 + 9 * 3600_000);
        issued.push({ reference: code(), kind: "attestation", title: "Attestation de scolarité", subjectId: p.studentId, schoolId: ceg, contentHash: hash(`attestation|${p.id}`), issuedById: secretary, createdAt: when });
      }
      const card = p.reportCards.at(-1);
      if (card) issued.push({ reference: code(), kind: "bulletin", title: "Bulletin de notes", subjectId: card.id, schoolId: ceg, contentHash: hash(`bulletin|${card.id}`), issuedById: director, createdAt: new Date(card.publishedAt.getTime() + 2 * 3600_000) });
    }
    const paid = await db.payment.findMany({ where: { invoice: { schoolId: ceg, enrollment: { academicYearId: y.id } } }, select: { id: true, paidAt: true }, orderBy: { paidAt: "asc" }, take: 30 });
    for (const p of paid) issued.push({ reference: code(), kind: "recu", title: "Reçu de paiement", subjectId: p.id, schoolId: ceg, contentHash: hash(`recu|${p.id}`), issuedById: accountant, createdAt: new Date(p.paidAt.getTime() + 5 * 60_000) });
    const classes = await db.classroom.findMany({ where: { schoolId: ceg, academicYearId: y.id }, select: { id: true } });
    for (const c of classes) issued.push({ reference: code(), kind: "liste", title: "Liste de classe", subjectId: c.id, schoolId: ceg, contentHash: hash(`liste|${c.id}`), issuedById: secretary, createdAt: new Date(y.startDate.getTime() + 3 * 86_400_000 + 10 * 3600_000) });
  }
  await db.issuedDocument.createMany({ data: issued, skipDuplicates: true });

  // 7. Pieces and justifications Sènami's family sent in 2025-2026 --------------
  const prev = years.at(-1)!;
  const senami = await db.enrollment.findFirst({ where: { academicYearId: prev.id, student: { userId: ctx.ids.student } }, select: { id: true, studentId: true } });
  const pieces = await db.requiredPiece.findMany({ where: { schoolId: ceg }, select: { id: true, label: true, isHealth: true, levelId: true } });
  // The school has asked for the same pieces for years.
  await db.requiredPiece.updateMany({ where: { schoolId: { in: [ceg, epp] } }, data: { createdAt: at("2022-08-29T08:00:00Z") } });
  if (senami) {
    const base = { studentId: senami.studentId, enrollmentId: senami.id, schoolId: ceg, submittedById: parent };
    for (const [i, p] of pieces.filter((x) => !x.levelId).entries()) {
      const sent = at(`2025-09-${String(15 + i).padStart(2, "0")}T19:00:00Z`);
      const reviewed = new Date(sent.getTime() + 2 * 86_400_000);
      const fileId = p.isHealth ? null : await saveFile(parent, `piece-${i + 1}.pdf`, p.label, sent);
      await db.familyDocument.create({
        data: { ...base, kind: "ENROLLMENT", requiredPieceId: p.id, fileId, status: "ACCEPTED", reviewedById: p.isHealth ? director : secretary, reviewedAt: reviewed, fileRemovedAt: p.isHealth ? reviewed : null, createdAt: sent },
      });
    }
    // An absence of the year, justified by the family and excused.
    const absence = await db.studentAttendance.findFirst({ where: { enrollmentId: senami.id }, orderBy: [{ date: "asc" }, { half: "asc" }], skip: 6, select: { id: true, date: true } });
    if (absence) {
      await db.studentAttendance.update({ where: { id: absence.id }, data: { status: "EXCUSED", reason: "Justifiée : rendez-vous médical." } });
      const sent = new Date(absence.date.getTime() + 19 * 3600_000);
      const fileId = await saveFile(parent, "justificatif-absence.pdf", "Certificat de consultation", sent);
      await db.familyDocument.create({
        data: { ...base, kind: "ABSENCE", attendanceId: absence.id, fileId, note: "Rendez-vous au centre de santé de Godomey.", status: "ACCEPTED", reviewedById: secretary, reviewedAt: new Date(sent.getTime() + 14 * 3600_000), createdAt: sent },
      });
    }
  }

  // 8. The activity log of the past years ---------------------------------------
  const logs: Prisma.AuditLogCreateManyInput[] = [];
  for (const y of years) {
    logs.push({ userId: minister, action: "update", resource: "academic_year", resourceId: y.id, summary: `Année scolaire ${y.label} clôturée`, createdAt: y.closedAt ?? y.endDate });
    const periods = await db.schoolPeriod.findMany({ where: { academicYearId: y.id }, select: { id: true, name: true, periodicity: true, endDate: true } });
    for (const p of periods) {
      const schoolId = p.periodicity === "SEMESTER" ? ceg : epp;
      logs.push({
        userId: schoolId === ceg ? director : eppHead,
        action: "publish",
        resource: "report_card",
        resourceId: p.id,
        schoolId,
        summary: `Bulletins du ${p.name.toLowerCase()} ${y.label} publiés pour toutes les classes`,
        createdAt: new Date(p.endDate.getTime() + 7 * 86_400_000 + 9 * 3600_000),
      });
    }
    for (const [schoolId, user] of [
      [ceg, director],
      [epp, eppHead],
    ] as const)
      logs.push({ userId: user, action: "create", resource: "council_decision", schoolId, summary: `Décisions de fin d'année ${y.label} enregistrées pour toutes les classes`, createdAt: new Date(y.endDate.getTime() + 3 * 86_400_000 + 10 * 3600_000) });
    logs.push({ userId: accountant, action: "create", resource: "fee_type", schoolId: ceg, summary: `Frais ${y.label} créés : contribution scolaire et cotisation APE, en trois tranches`, createdAt: new Date(y.startDate.getTime() - 10 * 86_400_000 + 9 * 3600_000) });
    logs.push({ userId: accountant, action: "create", resource: "invoice", schoolId: ceg, summary: `Factures ${y.label} générées pour tous les élèves`, createdAt: new Date(y.startDate.getTime() + 6 * 3600_000) });
  }
  const signIns = [director, secretary, accountant, teacher, ddestfp, inspector];
  for (let i = 0; i < 60; i++) {
    const y = years[Math.floor(rand() * years.length)]!;
    const when = new Date(y.startDate.getTime() + Math.floor(rand() * 280) * 86_400_000 + (7 + Math.floor(rand() * 10)) * 3600_000);
    logs.push({ userId: pick(signIns), action: "login", resource: "session", summary: "Connexion", createdAt: when });
  }
  await db.auditLog.createMany({ data: logs });

  // 9. A password reset handled in the past -------------------------------------
  const colleague = await db.user.findFirst({ where: { schoolId: ceg, role: { code: "TEACHER" }, id: { not: teacher } }, orderBy: { username: "desc" }, select: { id: true } });
  if (colleague) await db.passwordHelpRequest.create({ data: { userId: colleague.id, status: "RESOLVED", contact: "0196552310", handledById: director, handledAt: at("2025-01-14T10:20:00Z"), note: "Mot de passe réinitialisé, remis en main propre.", createdAt: at("2025-01-14T07:45:00Z") } });

  console.log(`history extras: ${requests.length} requests, ${docs.length} document requests, ${contents.length} contents, ${notifications.length} notifications, ${issued.length} issued documents, ${logs.length} log entries`);
}

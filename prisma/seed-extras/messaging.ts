import type { PrismaClient } from "../../src/generated/prisma/client";
import type { Chain } from "../../src/lib/domain/chains";
import { departmentInstitutionId, institutionName, mailboxUsername, MAILBOX_ROLE_CODE, MINISTRY, type InstitutionKind } from "../../src/lib/domain/institutions";

import type { SeedContext } from "./index";

// Institutional messaging: conversations between the ministry, the two
// directions of the Atlantique (DDEMP and DDESTFP), the circonscription of
// Abomey-Calavi and schools, answered by their staff, each along its chain. Each institution takes part through its mailbox account (see
// src/lib/domain/institutions.ts); each message records the person who
// wrote it. Deterministic, dated in the days before the demonstration.
export async function seedMessaging(db: PrismaClient, ctx: SeedContext) {
  const role = await db.role.upsert({
    where: { code: MAILBOX_ROLE_CODE },
    update: {},
    create: {
      code: MAILBOX_ROLE_CODE,
      name: "Boîte de messagerie d'institution",
      description: "Compte technique sans connexion qui représente un établissement ou un service dans la messagerie.",
      scopeLevel: "NATIONAL",
      isSystem: true,
    },
  });

  const person = async (username: string) => (await db.user.findUnique({ where: { username }, select: { id: true } }))?.id ?? null;
  const [ddestfp, ddemp, inspector] = await Promise.all([person("aristide.gbaguidi"), person("clarisse.akpovi"), person("benedicta.zannou")]);
  const atlantique = await db.department.findUnique({ where: { name: "Atlantique" }, select: { id: true, name: true } });
  const calavi = atlantique && (await db.commune.findFirst({ where: { departmentId: atlantique.id, name: "Abomey-Calavi" }, select: { id: true, name: true } }));
  if (!ddestfp || !ddemp || !inspector || !atlantique || !calavi) return;
  // The circonscription writes to the nursery and primary schools of its
  // commune; the DDESTFP to the colleges of the department.
  const districtSchools = await db.school.findMany({ where: { communeId: calavi.id, cycle: { in: ["PRESCHOOL", "PRIMARY"] } }, select: { id: true, name: true }, orderBy: { code: "asc" } });
  const colleges = await db.school.findMany({ where: { commune: { departmentId: atlantique.id }, cycle: "SECONDARY", isActive: true }, select: { id: true, name: true }, orderBy: { code: "asc" } });
  const ceg = colleges.find((s) => s.id === ctx.schools.ceg);
  // The partner school of the transfer: another secondary school of the district.
  const partner = await db.school.findFirst({ where: { communeId: calavi.id, cycle: "SECONDARY", id: { not: ctx.schools.ceg } }, select: { id: true, name: true }, orderBy: { code: "asc" } });
  if (!ceg || !partner) return;
  const partnerHead = await db.user.findFirst({ where: { schoolId: partner.id, scopeLevel: "SCHOOL", role: { code: "SCHOOL_DIRECTOR" } }, select: { id: true } });
  const secretary = await db.user.findFirst({ where: { schoolId: ceg.id, role: { code: "SECRETARY" } }, select: { id: true } });
  if (!partnerHead) return;

  const mailbox = async (kind: InstitutionKind, id: string, name: string | null, chain: Chain | null = null) => {
    const username = mailboxUsername({ kind, id: kind === "DEPARTMENT" ? departmentInstitutionId(id, chain) : id });
    const u = await db.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        firstName: institutionName(kind, name, chain),
        lastName: "",
        passwordHash: "!",
        isActive: false,
        roleId: role.id,
        scopeLevel: kind === "MINISTRY" ? "NATIONAL" : kind,
        departmentId: kind === "DEPARTMENT" ? id : null,
        communeId: kind === "COMMUNE" ? id : null,
        schoolId: kind === "SCHOOL" ? id : null,
      },
      select: { id: true },
    });
    return u.id;
  };
  const ministryBox = await mailbox("MINISTRY", MINISTRY.id, null);
  const ddempBox = await mailbox("DEPARTMENT", atlantique.id, atlantique.name, "PRIMARY");
  const ddestfpBox = await mailbox("DEPARTMENT", atlantique.id, atlantique.name, "SECONDARY");
  const districtBox = await mailbox("COMMUNE", calavi.id, calavi.name);
  const schoolBoxes = new Map<string, string>();
  for (const s of [...districtSchools, ...colleges, partner]) if (!schoolBoxes.has(s.id)) schoolBoxes.set(s.id, await mailbox("SCHOOL", s.id, s.name));
  const cegBox = schoolBoxes.get(ceg.id)!;
  const partnerBox = schoolBoxes.get(partner.id)!;

  const at = (iso: string) => new Date(iso);
  type Line = { from: string; body: string; at: Date };
  // readBy: the read marker of each party (null: never opened).
  const thread = async (subject: string, lines: Line[], readBy: Record<string, Date | null>) => {
    const c = await db.conversation.create({
      data: {
        subject,
        createdAt: lines[0]!.at,
        updatedAt: lines[lines.length - 1]!.at,
        participants: { create: Object.entries(readBy).map(([userId, lastReadAt]) => ({ userId, lastReadAt })) },
        messages: { create: lines.map((l) => ({ senderId: l.from, body: l.body, createdAt: l.at })) },
      },
    });
    return c.id;
  };

  // Ministry and DDEMP of the Atlantique: the primary schools' needs.
  await thread(
    "Besoins en tables-bancs pour la rentrée",
    [
      {
        from: ctx.ids.minister,
        body: "Bonjour. Le ministère prépare la répartition des tables-bancs financés par le budget de l'État. Merci de nous transmettre, avant le 30 septembre, le nombre de places assises manquantes par école de l'Atlantique, en commençant par les classes de CI.",
        at: at("2026-09-21T08:40:00Z"),
      },
      {
        from: ddemp,
        body: "Bonjour. Bien reçu. Les chefs de circonscription recensent les besoins cette semaine. Premiers chiffres : il manque environ 1 450 places assises dans les écoles primaires du département, dont près de la moitié à Abomey-Calavi, où les effectifs de CI ont fortement augmenté. Le tableau détaillé suivra vendredi.",
        at: at("2026-09-22T16:10:00Z"),
      },
      {
        from: ctx.ids.minister,
        body: "Merci pour ce premier point. Indiquez aussi les écoles où des élèves suivent les cours assis par terre : elles seront servies en priorité.",
        at: at("2026-09-23T09:05:00Z"),
      },
    ],
    { [ministryBox]: at("2026-09-23T09:05:00Z"), [ddempBox]: at("2026-09-23T10:30:00Z") },
  );

  // The circonscription of Abomey-Calavi to each of its schools, sent at
  // once: one conversation per school, with its own read receipt.
  const circular =
    "Bonjour. Dans le cadre de la collecte des effectifs de rentrée, merci de vérifier dans Classéo, avant le mardi 29 septembre, que tous vos élèves sont inscrits dans leur classe, et de signaler les classes de plus de 60 élèves. Une réunion des directeurs d'école aura lieu le jeudi 1er octobre à 9 h à la circonscription.";
  const sentAt = at("2026-09-22T07:50:00Z");
  for (const s of districtSchools) {
    const opened = districtSchools.indexOf(s) % 2 === 1 ? at("2026-09-22T12:15:00Z") : null;
    await thread("Collecte des effectifs de rentrée", [{ from: inspector, body: circular, at: sentAt }], { [districtBox]: sentAt, [schoolBoxes.get(s.id)!]: opened });
  }

  // The DDESTFP of the Atlantique to each college of the department.
  const collegeCircular =
    "Bonjour. Dans le cadre de la collecte des effectifs de rentrée, merci de vérifier dans Classéo, avant le mardi 29 septembre, que tous vos élèves sont inscrits dans leur classe, et de signaler les classes de plus de 60 élèves. Une réunion des chefs d'établissement aura lieu le jeudi 1er octobre à 9 h à la direction départementale.";
  for (const s of colleges) {
    const box = schoolBoxes.get(s.id)!;
    if (s.id === ceg.id) {
      await thread(
        "Collecte des effectifs de rentrée",
        [
          { from: ddestfp, body: collegeCircular, at: sentAt },
          {
            from: ctx.ids.director,
            body: "Bonjour Monsieur le Directeur départemental. Les inscriptions du CEG Godomey sont à jour. Deux classes dépassent 60 élèves : la 6e A (64) et la 6e B (62). Nous proposons d'ouvrir une troisième classe de 6e si un enseignant supplémentaire nous est affecté. Je serai présent à la réunion du 1er octobre.",
            at: at("2026-09-23T10:20:00Z"),
          },
          ...(secretary
            ? [{ from: secretary.id, body: "Je vous transmets en complément la liste des élèves de 6e par classe, extraite ce matin de Classéo.", at: at("2026-09-23T10:45:00Z") }]
            : []),
        ],
        // The direction has not opened the answer yet.
        { [ddestfpBox]: sentAt, [box]: at("2026-09-23T10:45:00Z") },
      );
    } else {
      // Some colleges opened the circular, others not yet.
      const opened = colleges.indexOf(s) % 2 === 1 ? at("2026-09-22T12:15:00Z") : null;
      await thread("Collecte des effectifs de rentrée", [{ from: ddestfp, body: collegeCircular, at: sentAt }], { [ddestfpBox]: sentAt, [box]: opened });
    }
  }

  // School to school: a pupil's transfer between two colleges of the district.
  await thread(
    "Transfert d'un élève de 5e vers votre établissement",
    [
      {
        from: ctx.ids.director,
        body: `Bonjour. La famille de Kokou Agbéssi, élève de 5e B au CEG Godomey, déménage à Abomey-Calavi centre et souhaite l'inscrire au ${partner.name}. Pouvez-vous nous confirmer qu'il vous reste une place en 5e ? Nous préparons le certificat de radiation et les bulletins de l'an dernier.`,
        at: at("2026-09-23T14:30:00Z"),
      },
      {
        from: partnerHead.id,
        body: "Bonjour Monsieur le Directeur. Oui, nous pouvons l'accueillir en 5e C à partir du lundi 28 septembre. Merci d'envoyer le dossier par Classéo ; la famille pourra passer au secrétariat pour finaliser l'inscription.",
        at: at("2026-09-24T09:10:00Z"),
      },
    ],
    // The answer is waiting for the CEG Godomey.
    { [cegBox]: at("2026-09-23T14:30:00Z"), [partnerBox]: at("2026-09-24T09:10:00Z") },
  );
}

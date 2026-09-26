// Demonstration accounts shown on the sign in page so a visitor can try every
// role. They exist only in seeded demo data. Accounts sign in with the
// identifier built from their names; the e-mail still works for those that
// have one.
export const DEMO_PASSWORD = "Classeo2026";

export const DEMO_ACCOUNTS = [
  { username: "adjoa.houngbedji", email: "ministre@classeo.bj", role: "Administratrice nationale", scope: "Ministères, tout le Bénin" },
  { username: "rodrigue.kpadonou", email: "analyste@classeo.bj", role: "Analyste national", scope: "Cellule statistique" },
  { username: "aristide.gbaguidi", email: "ddestfp.atlantique@classeo.bj", role: "Directeur départemental (DDESTFP)", scope: "Atlantique, collèges et lycées" },
  { username: "clarisse.akpovi", email: "ddemp.atlantique@classeo.bj", role: "Directrice départementale (DDEMP)", scope: "Atlantique, maternelle et primaire" },
  { username: "benedicta.zannou", email: "cs.abomey-calavi@classeo.bj", role: "Cheffe de circonscription scolaire", scope: "Abomey-Calavi, écoles primaires" },
  { username: "florentin.agossou", email: "directeur@classeo.bj", role: "Chef d'établissement", scope: "CEG Godomey" },
  { username: "pelagie.tossou", email: "secretaire@classeo.bj", role: "Secrétaire", scope: "CEG Godomey" },
  { username: "gildas.sossou", email: "comptable@classeo.bj", role: "Comptable", scope: "CEG Godomey" },
  { username: "nafissatou.issifou", email: "enseignant@classeo.bj", role: "Enseignante", scope: "Mathématiques, CEG Godomey" },
  { username: "afiavi.hounkpatin", email: "parent@classeo.bj", role: "Parent", scope: "Deux enfants scolarisés" },
  { username: "senami.hounkpatin", email: "eleve@classeo.bj", role: "Élève", scope: "3e A, CEG Godomey" },
  { username: "estelle.amoussou", email: "partenaire@classeo.bj", role: "Structure partenaire", scope: "ONG, lecture seule" },
] as const;

// Demonstration accounts shown on the sign in page so the jury can test every
// role live. They exist only in seeded demo data.
export const DEMO_PASSWORD = "Classeo2026";

export const DEMO_ACCOUNTS = [
  { email: "ministre@classeo.bj", role: "Administrateur national", scope: "Ministère, tout le Bénin" },
  { email: "analyste@classeo.bj", role: "Analyste national", scope: "Cellule statistique" },
  { email: "ddemp.atlantique@classeo.bj", role: "Directeur départemental", scope: "Atlantique" },
  { email: "cs.abomey-calavi@classeo.bj", role: "Chef de circonscription", scope: "Abomey-Calavi" },
  { email: "directeur@classeo.bj", role: "Chef d'établissement", scope: "CEG Godomey" },
  { email: "secretaire@classeo.bj", role: "Secrétaire", scope: "CEG Godomey" },
  { email: "comptable@classeo.bj", role: "Comptable", scope: "CEG Godomey" },
  { email: "enseignant@classeo.bj", role: "Enseignant", scope: "Mathématiques, CEG Godomey" },
  { email: "parent@classeo.bj", role: "Parent", scope: "Deux enfants scolarisés" },
  { email: "eleve@classeo.bj", role: "Élève", scope: "3e A, CEG Godomey" },
  { email: "partenaire@classeo.bj", role: "Structure partenaire", scope: "ONG, lecture seule" },
] as const;

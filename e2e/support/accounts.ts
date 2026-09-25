import path from "node:path";

import { DEMO_PASSWORD } from "../../src/lib/demo/accounts";

// Seeded demonstration accounts used by the suite (prisma/seed.ts). The
// password can be overridden for an environment where it was changed.
export const PASSWORD = process.env.E2E_PASSWORD ?? DEMO_PASSWORD;

export const ACCOUNTS = {
  ministre: "ministre@classeo.bj",
  analyste: "analyste@classeo.bj",
  ddemp: "ddemp.atlantique@classeo.bj",
  directeur: "directeur@classeo.bj",
  secretaire: "secretaire@classeo.bj",
  comptable: "comptable@classeo.bj",
  enseignant: "enseignant@classeo.bj",
  parent: "parent@classeo.bj",
  eleve: "eleve@classeo.bj",
} as const;

export type Role = keyof typeof ACCOUNTS;

export const ROLES = Object.keys(ACCOUNTS) as Role[];

// Kept for the wrong password journey only, so the lockout counter of an
// account the other journeys rely on is never touched.
export const PARTNER_EMAIL = "partenaire@classeo.bj";

// Session cookies saved by auth.setup.ts, one file per role. The folder is
// git ignored (.playwright/).
export function authFile(role: Role) {
  return path.join(__dirname, "..", "..", ".playwright", "auth", `${role}.json`);
}

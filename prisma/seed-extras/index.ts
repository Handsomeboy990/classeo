// Extra demonstration data per feature, run at the end of prisma/seed.ts.
// Each feature owns its file so parallel work never edits the same seed code.
import type { PrismaClient } from "../../src/generated/prisma/client";

import { seedGovernance } from "./governance";
import { seedIdentity } from "./identity";
import { seedLifecycle } from "./lifecycle";
import { seedPaymentsAndSignatures } from "./payments-signatures";
import { seedWave2 } from "./wave2";

export type SeedContext = {
  passwordHash: string;
  ids: { minister: string; director: string; accountant: string; parent: string; student: string; teacher: string };
  schools: { ceg: string; epp: string };
  yearId: string;
};

export async function seedExtras(db: PrismaClient, ctx: SeedContext) {
  await seedIdentity(db, ctx);
  await seedGovernance(db, ctx);
  await seedLifecycle(db, ctx);
  await seedPaymentsAndSignatures(db, ctx);
  await seedWave2(db, ctx);
}

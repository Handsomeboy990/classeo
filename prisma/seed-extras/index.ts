// Extra demonstration data per feature, run at the end of prisma/seed.ts.
// Each feature owns its file so parallel work never edits the same seed code.
import type { PrismaClient } from "../../src/generated/prisma/client";

import { seedGovernance } from "./governance";
import { seedIdentity } from "./identity";
import { seedLanguages } from "./languages";
import { seedLifecycle } from "./lifecycle";
import { seedPay } from "./pay";
import { seedPaymentsAndSignatures } from "./payments-signatures";
import { seedFamilyExchange } from "./family-exchange";
import { seedHistoryExtras } from "./history";
import { seedWave2 } from "./wave2";

export type SeedContext = {
  passwordHash: string;
  ids: { minister: string; director: string; accountant: string; parent: string; student: string; teacher: string };
  schools: { ceg: string; epp: string };
  yearId: string;
};

export async function seedExtras(db: PrismaClient, ctx: SeedContext) {
  await seedIdentity(db, ctx);
  await seedPay(db, ctx);
  await seedGovernance(db, ctx);
  await seedLifecycle(db, ctx);
  await seedPaymentsAndSignatures(db, ctx);
  await seedWave2(db, ctx);
  await seedFamilyExchange(db, ctx);
  await seedLanguages(db, ctx);
  await seedHistoryExtras(db, ctx);
}

import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";
import { seedMessaging } from "./messaging";

// Demonstration data owned by this feature. Keep it deterministic.
export async function seedWave2(db: PrismaClient, ctx: SeedContext) {
  void db;
  void ctx;
  await seedMessaging(db, ctx);
}

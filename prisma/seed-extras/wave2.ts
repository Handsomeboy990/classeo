import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";

// Demonstration data owned by this feature. Keep it deterministic.
export async function seedWave2(db: PrismaClient, ctx: SeedContext) {
  void db;
  void ctx;
}

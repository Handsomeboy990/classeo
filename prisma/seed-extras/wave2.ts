import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";
import { seedMessaging } from "./messaging";
import { seedMockExams } from "./mock-exams";

// Demonstration data of the second wave features. Keep it deterministic.
export async function seedWave2(db: PrismaClient, ctx: SeedContext) {
  await seedMessaging(db, ctx);
  await seedMockExams(db, ctx);
}

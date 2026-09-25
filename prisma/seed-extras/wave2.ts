import type { PrismaClient } from "../../src/generated/prisma/client";

import type { SeedContext } from "./index";
import { seedMockExams } from "./mock-exams";

// Demonstration data owned by this feature. Keep it deterministic.
export async function seedWave2(db: PrismaClient, ctx: SeedContext) {
  await seedMockExams(db, ctx);
}

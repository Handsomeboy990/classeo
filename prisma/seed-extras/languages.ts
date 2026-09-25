import type { PrismaClient } from "../../src/generated/prisma/client";

import translations from "./translations.json";
import type { SeedContext } from "./index";

// Interface translations of the family pages into Fon and Yoruba, prepared
// once with the translation service (rate limited to five calls a minute)
// and shipped with the demo data, so a parent sees the interface in their
// language at once.
export async function seedLanguages(db: PrismaClient, ctx: SeedContext) {
  void ctx;
  const rows = translations as { key: string; lang: string; source: string; text: string }[];
  for (let i = 0; i < rows.length; i += 1000) {
    await db.translation.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
  }
  console.log(`languages: ${rows.length} cached translations`);
}

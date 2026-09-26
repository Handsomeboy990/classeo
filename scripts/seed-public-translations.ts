// Loads the Fon and Yoruba translations of the public pages (home, sign in,
// forgotten password, photo credits) into a database that is already
// running, without reseeding it. Idempotent: rows already present are left
// as they are, so it can be run again safely. Makes no call to the
// translation service; the rows come from prisma/seed-extras/translations.json
// (filled by `npx tsx scripts/pretranslate.ts --public`).
//
// Usage:
//   npx tsx scripts/seed-public-translations.ts --dry-run   count only
//   npx tsx scripts/seed-public-translations.ts             insert what is missing
// The database is the one of DATABASE_URL (.env, or set on the command line
// for production). The pages pick the new rows up within five minutes.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import translations from "../prisma/seed-extras/translations.json";
import { PrismaClient } from "../src/generated/prisma/client";
import { cacheKey } from "../src/features/languages/cache-key";
import { normalise } from "../src/features/languages/text";
import { publicSources } from "../src/features/public-pages/texts";

type Row = { key: string; lang: string; source: string; text: string };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const keys = new Set(publicSources().map((s) => cacheKey(normalise(s))));
  const rows = (translations as Row[]).filter((r) => keys.has(r.key) && (r.lang === "fon" || r.lang === "yo"));
  const perLang = (lang: string) => rows.filter((r) => r.lang === lang).length;
  console.log(`Public texts: ${keys.size}. Rows in the seed file: ${perLang("fon")} fon, ${perLang("yo")} yo.`);
  const host = new URL(url).hostname;
  if (process.argv.includes("--dry-run")) {
    console.log(`Dry run: nothing written to ${host}.`);
    return;
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const { count } = await db.translation.createMany({ data: rows, skipDuplicates: true });
    console.log(`${host}: ${count} rows inserted, ${rows.length - count} already present.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

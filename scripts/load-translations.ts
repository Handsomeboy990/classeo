// Loads the interface translations shipped in
// prisma/seed-extras/translations.json into a database that is already
// running (production included), without reseeding it and without any call
// to the translation service.
//
// Idempotent and non destructive: missing rows are inserted, rows whose
// translation changed in the file are updated, nothing is ever deleted, and
// rows the application cached on its own (not in the file) are left as they
// are. Running it twice changes nothing the second time.
//
// Usage:
//   npx tsx scripts/load-translations.ts --dry-run   count what would change
//   npx tsx scripts/load-translations.ts             write
// The database is the one of DATABASE_URL (.env, or set on the command line
// for production). Pages pick the new rows up at their next request.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import translations from "../prisma/seed-extras/translations.json";
import { PrismaClient } from "../src/generated/prisma/client";
import { cacheKey } from "../src/features/languages/cache-key";
import { isTargetLanguage } from "../src/features/languages/languages";

type Row = { key: string; lang: string; source: string; text: string };

const CHUNK = 500;

// Every row must be what the application would look up: a known language
// and the key of its own source text.
function validRows(rows: Row[]) {
  const bad = rows.filter((r) => !isTargetLanguage(r.lang) || r.key !== cacheKey(r.source) || !r.text);
  if (bad.length) throw new Error(`${bad.length} invalid row(s) in translations.json, first: ${bad[0]!.lang} ${bad[0]!.source}`);
  return rows;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const dryRun = process.argv.includes("--dry-run");
  const rows = validRows(translations as Row[]);
  const host = new URL(url).hostname;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const existing = await db.translation.findMany({
        where: { OR: [...new Set(chunk.map((r) => r.lang))].map((lang) => ({ lang, key: { in: chunk.filter((r) => r.lang === lang).map((r) => r.key) } })) },
        select: { key: true, lang: true, text: true },
      });
      const current = new Map(existing.map((r) => [`${r.lang}:${r.key}`, r.text]));
      const missing = chunk.filter((r) => !current.has(`${r.lang}:${r.key}`));
      const changed = chunk.filter((r) => current.has(`${r.lang}:${r.key}`) && current.get(`${r.lang}:${r.key}`) !== r.text);
      unchanged += chunk.length - missing.length - changed.length;
      if (dryRun) {
        inserted += missing.length;
        updated += changed.length;
        continue;
      }
      // skipDuplicates: a row cached meanwhile by the application is kept.
      inserted += (await db.translation.createMany({ data: missing, skipDuplicates: true })).count;
      for (const r of changed) {
        await db.translation.update({ where: { key_lang: { key: r.key, lang: r.lang } }, data: { text: r.text, source: r.source } });
        updated++;
      }
    }
    const perLang = [...new Set(rows.map((r) => r.lang))].map((l) => `${rows.filter((r) => r.lang === l).length} ${l}`).join(", ");
    console.log(`translations.json: ${rows.length} rows (${perLang}).`);
    console.log(
      dryRun
        ? `${host} (dry run, nothing written): ${inserted} would be inserted, ${updated} would be updated, ${unchanged} already up to date.`
        : `${host}: ${inserted} inserted, ${updated} updated, ${unchanged} already up to date.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

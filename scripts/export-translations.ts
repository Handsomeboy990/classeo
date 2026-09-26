// Writes the interface translations cached in a local database into
// prisma/seed-extras/translations.json, the file the seed and
// scripts/load-translations.ts read. Run after scripts/pretranslate.ts
// against a local database: the rows already in the file are kept, the new
// ones added, a row whose translation changed replaced. Rows the service
// sent back unusable are kept as their own French text, so they are never
// asked again.
//
// Usage:
//   npx tsx scripts/export-translations.ts --dry-run    count only
//   npx tsx scripts/export-translations.ts --lang fon,yo
//
// Same layout as the file already holds: sorted by language then key, one
// field per line, so a new run only adds lines to the diff and two branches
// adding rows merge as a union.

import "dotenv/config";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { cacheKey } from "../src/features/languages/cache-key";

type Row = { key: string; lang: string; source: string; text: string };

const SEED_FILE = path.resolve(__dirname, "../prisma/seed-extras/translations.json");

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "");
}

function serialise(rows: Row[]) {
  const sorted = [...rows].sort((a, b) => (a.lang === b.lang ? (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) : a.lang < b.lang ? -1 : 1));
  const body = sorted.map((r) => `{\n${(["key", "lang", "source", "text"] as const).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(r[k])}`).join(",\n")}\n}`);
  return `[\n${body.join(",\n")}\n]`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const langs = (arg("lang") ?? "fon,yo").split(",").map((l) => l.trim());
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const cached = await db.translation.findMany({ where: { lang: { in: langs } }, select: { key: true, lang: true, source: true, text: true } });
    const seed = JSON.parse(readFileSync(SEED_FILE, "utf8")) as Row[];
    const rows = new Map(seed.map((r) => [`${r.lang}:${r.key}`, r]));
    let added = 0;
    let changed = 0;
    for (const r of cached) {
      if (r.key !== cacheKey(r.source)) continue;
      const id = `${r.lang}:${r.key}`;
      const before = rows.get(id);
      if (!before) added++;
      else if (before.text !== r.text) changed++;
      else continue;
      rows.set(id, r);
    }
    console.log(`${SEED_FILE}: ${added} rows added, ${changed} changed, ${rows.size} in all.`);
    if (!process.argv.includes("--dry-run")) writeFileSync(SEED_FILE, serialise([...rows.values()]));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

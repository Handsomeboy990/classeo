// Fills the translation cache with the static French strings of the family
// pages (dashboard, children, report cards, attendance, timetable, fees,
// messages, announcements, help), so that parents see them translated on
// their first visit without waiting for the background queue.
//
// Usage:
//   npx tsx scripts/pretranslate.ts --dry-run            list what would be sent
//   npx tsx scripts/pretranslate.ts --lang fon,yo        translate (default: fon,yo)
//   npx tsx scripts/pretranslate.ts --lang fon --max 300 at most 300 strings
//   npx tsx scripts/pretranslate.ts --from strings.json  the strings of a JSON
//     list instead of the source scan, such as the sentences and templates a
//     page run collects (the scan cannot rebuild a sentence split by inline
//     elements, nor a template of names and figures)
// Then scripts/export-translations.ts writes the new rows into the seed.
//
// Strings already cached are never sent again. Requests carry 100 strings
// and respect the quota of the service (5 requests per minute per token),
// counted in the same database window as the application, so the two never
// exceed it together. Credentials come from the environment (.env).

import "dotenv/config";

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { QuotaError, translateMany } from "../src/features/languages/api";
import { cacheKey } from "../src/features/languages/cache-key";
import { isTargetLanguage, type TargetLanguage } from "../src/features/languages/languages";
import { batches, isCandidate, normalise } from "../src/features/languages/text";
import { realClock, TokenBucket } from "../src/features/languages/token-bucket";

const ROOT = path.resolve(__dirname, "..");
const SOURCES = [
  "src/features/family",
  "src/features/report-cards",
  "src/features/attendance",
  "src/features/timetable",
  "src/features/fees",
  "src/features/payments",
  "src/features/messages",
  "src/features/contents",
  "src/features/help",
  "src/features/students",
  "src/features/notifications",
  "src/features/mock-exams",
  "src/features/online-payment",
  "src/features/student-history",
  "src/features/offline",
  "src/features/pwa",
  "src/features/push",
  "src/features/school-status",
  "src/features/languages/translate-content.tsx",
  "src/features/languages/voice-info.tsx",
  "src/app/espace/(accueil)",
  "src/app/espace/suivi",
  "src/app/espace/bulletins",
  "src/app/espace/presences",
  "src/app/espace/emploi-du-temps",
  "src/app/espace/frais",
  "src/app/espace/messages",
  "src/app/espace/contenus",
  "src/app/espace/aide",
  "src/app/espace/notifications",
  "src/app/espace/preferences",
  "src/app/espace/examens-blancs",
  "src/app/espace/payer",
  "src/app/espace/eleves/[id]",
  "src/app/espace/bulletins/[enrollmentId]",
  "src/app/espace/frais/factures",
  "src/app/espace/frais/paiements",
  "src/app/espace/layout.tsx",
  "src/app/espace/error.tsx",
  "src/app/layout.tsx",
  "src/components/ui",
  "src/components/kit",
  "src/components/shell",
  "src/lib/navigation.ts",
  "src/lib/action.ts",
  "src/lib/errors.ts",
  "src/lib/domain",
];

const API_RATE_KEY = "langues229:api"; // same window as src/features/languages/service.ts
const PER_MINUTE = 5;

function files(entry: string): string[] {
  const full = path.join(ROOT, entry);
  let st;
  try {
    st = statSync(full);
  } catch {
    return [];
  }
  if (st.isFile()) return /\.(ts|tsx)$/.test(full) && !/\.test\.ts$/.test(full) ? [full] : [];
  return readdirSync(full).flatMap((name) => files(path.join(entry, name)));
}

function decode(text: string) {
  return text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "’");
}

// Interface text, not code: starts with a capital, has lowercase letters and
// only the punctuation of a sentence.
function looksLikeText(s: string) {
  if (!/^[\p{Lu}«]/u.test(s) || !/\p{Ll}/u.test(s)) return false;
  if (/[{}<>=\\_#@|$`*[\]^~]/.test(s)) return false;
  if (!s.includes(" ") && /^\p{Lu}\p{Ll}+\p{Lu}/u.test(s)) return false; // PageHeader
  if (/\.(tsx?|js|css|png|svg|pdf)$/.test(s)) return false;
  if (/\/\S/.test(s)) return false; // paths, fractions
  return isCandidate(s) && s.length <= 200;
}

export function collect() {
  const found = new Set<string>();
  for (const file of SOURCES.flatMap(files)) {
    const src = readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const candidates: string[] = [];
    for (const m of src.matchAll(/[>}]([^<>{}]+)[<{]/g)) candidates.push(m[1]!);
    for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) candidates.push(m[1]!);
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) candidates.push(m[1]!);
    // Template literals: the static parts around the values, "Bonjour, "
    // in `Bonjour, ${name}`.
    for (const m of src.matchAll(/`([^`]*)`/g)) candidates.push(...m[1]!.split(/\$\{[^}]*\}/));
    for (const c of candidates) {
      const s = normalise(decode(c.replace(/\\'/g, "'").replace(/\\"/g, '"')));
      if (looksLikeText(s)) found.add(s);
      // "Bonjour, {name}": also the part before a trailing punctuation.
      const trimmed = s.replace(/[\s,:;–]+$/u, "");
      if (trimmed !== s && looksLikeText(trimmed)) found.add(trimmed);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b, "fr"));
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "");
}

async function main() {
  const strings = collect();
  const dryRun = process.argv.includes("--dry-run");
  const langs = (arg("lang") ?? "fon,yo").split(",").map((l) => l.trim());
  const max = Number(arg("max") ?? "100000");
  for (const l of langs) if (!isTargetLanguage(l)) throw new Error(`Unknown language: ${l}`);
  const from = arg("from");
  if (from) {
    const list = (JSON.parse(readFileSync(path.resolve(from), "utf8")) as unknown[]).filter((s): s is string => typeof s === "string");
    strings.splice(0, strings.length, ...new Set(list.map(normalise).filter(isCandidate)));
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const baseUrl = process.env.LANGUES229_API_URL;
  const token = process.env.LANGUES229_HF_TOKEN;
  const apiKey = process.env.LANGUES229_API_KEY;
  if (!dryRun && (!baseUrl || !token || !apiKey)) throw new Error("LANGUES229_API_URL, LANGUES229_HF_TOKEN and LANGUES229_API_KEY must be set");

  const bucket = new TokenBucket(PER_MINUTE, 60_000 / PER_MINUTE);
  // The shared per minute window, as in src/lib/rate-limit.ts.
  async function takeToken() {
    await bucket.acquire(Infinity);
    for (;;) {
      const now = new Date();
      const row = await db.$transaction(async (tx) => {
        const current = await tx.rateLimit.findUnique({ where: { key: API_RATE_KEY } });
        if (!current || current.windowStart < new Date(now.getTime() - 60_000)) {
          return tx.rateLimit.upsert({ where: { key: API_RATE_KEY }, create: { key: API_RATE_KEY, count: 1, windowStart: now }, update: { count: 1, windowStart: now } });
        }
        return tx.rateLimit.update({ where: { key: API_RATE_KEY }, data: { count: { increment: 1 } } });
      });
      if (row.count <= PER_MINUTE) return true;
      await realClock.sleep(row.windowStart.getTime() + 60_000 - now.getTime() + 250);
    }
  }

  let calls = 0;
  try {
    for (const lang of langs as TargetLanguage[]) {
      const known = new Set<string>();
      for (const part of batches(strings, 500)) {
        const rows = await db.translation.findMany({ where: { lang, key: { in: part.map(cacheKey) } }, select: { key: true } });
        rows.forEach((r) => known.add(r.key));
      }
      const todo = strings.filter((s) => !known.has(cacheKey(s))).slice(0, max);
      console.log(`${lang}: ${strings.length} strings, ${strings.length - known.size} not cached, ${todo.length} to send in ${Math.ceil(todo.length / 100)} request(s)`);
      if (dryRun) {
        if (lang === langs[0]) todo.forEach((s) => console.log(`  ${s}`));
        continue;
      }
      try {
        const { translations, complete } = await translateMany(
          { baseUrl: baseUrl!, token: token!, apiKey: apiKey! },
          todo,
          lang,
          async () => {
            calls++;
            return takeToken();
          },
          async (done, sent) => {
            await db.translation.createMany({
              data: sent.map((source) => ({ key: cacheKey(source), lang, source, text: done.get(source) ?? source })),
              skipDuplicates: true,
            });
            console.log(`  ${lang}: ${done.size}/${sent.length} translated`);
          },
        );
        console.log(`${lang}: ${translations.size} translations cached${complete ? "" : " (stopped early)"}`);
      } catch (error) {
        if (error instanceof QuotaError) console.error(`${lang}: quota reached, run again in a minute`);
        else throw error;
      }
    }
  } finally {
    console.log(`Requests to the translation service: ${calls}`);
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

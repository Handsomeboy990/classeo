import "server-only";

import { db } from "@/lib/db";

import { buildNameIndex, fragmentCore, type NameIndex } from "./privacy";

// Server side of the rules of privacy.ts: the names known to the platform
// and the messages a user can read, so the server decides what leaves the
// platform, never the browser.

const NAMES_TTL_MS = 10 * 60 * 1000;
const g = globalThis as unknown as { __languesNames?: { index: NameIndex; at: number; loading?: Promise<NameIndex> } };

async function loadNames(): Promise<NameIndex> {
  const rows = await db.$queryRaw<{ n: string }[]>`
    SELECT "firstName" AS n FROM "User" UNION SELECT "lastName" FROM "User"
    UNION SELECT "firstName" FROM "Student" UNION SELECT "lastName" FROM "Student"
    UNION SELECT "firstName" FROM "Guardian" UNION SELECT "lastName" FROM "Guardian"
    UNION SELECT "firstName" FROM "Teacher" UNION SELECT "lastName" FROM "Teacher"`;
  return buildNameIndex(rows.map((r) => r.n));
}

// Every part of every first and last name of the accounts, pupils,
// guardians and teachers, refreshed every ten minutes per instance. A name
// added in between is still templated on the reader's page, where it comes
// from namesFor().
export async function knownNameIndex(): Promise<NameIndex> {
  const cached = g.__languesNames;
  if (cached && Date.now() - cached.at < NAMES_TTL_MS) return cached.index;
  if (cached?.loading) return cached.loading;
  const loading = loadNames();
  g.__languesNames = { index: cached?.index ?? new Set(), at: cached?.at ?? 0, loading };
  try {
    const index = await loading;
    g.__languesNames = { index, at: Date.now() };
    return index;
  } catch (error) {
    g.__languesNames = cached ? { index: cached.index, at: cached.at } : undefined;
    throw error;
  }
}

// The texts that are part of a message the user can read, or of one of
// their notifications (which quote messages), or that contain one: a
// message between people is never sent to the translation service, whole
// or in pieces. Texts shorter than 4 characters are not compared, and a
// message is looked for inside a longer text from 12 characters on.
export async function messageFragments(userId: string, texts: readonly string[]): Promise<Set<string>> {
  const cores = [...new Set(texts.map(fragmentCore).filter((t) => t.length >= 4))];
  if (!cores.length) return new Set();
  const rows = await db.$queryRaw<{ t: string }[]>`
    WITH c(t) AS (SELECT unnest(${cores}::text[])),
    own AS (
      SELECT regexp_replace(btrim(m."body"), '\\s+', ' ', 'g') AS body
      FROM "Message" m JOIN "ConversationParticipant" p ON p."conversationId" = m."conversationId"
      WHERE p."userId" = ${userId} AND length(m."body") >= 4
      UNION ALL
      SELECT regexp_replace(btrim(n."body"), '\\s+', ' ', 'g') FROM "Notification" n
      WHERE n."userId" = ${userId} AND n."kind" = 'message' AND length(n."body") >= 4
    )
    SELECT c.t FROM c WHERE EXISTS (
      SELECT 1 FROM own
      WHERE strpos(own.body, c.t) > 0 OR (length(own.body) >= 12 AND strpos(c.t, rtrim(own.body, '.… ')) > 0)
    )`;
  const hit = new Set(rows.map((r) => r.t));
  return new Set(texts.filter((t) => hit.has(fragmentCore(t))));
}

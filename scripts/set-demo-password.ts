// Sets the password of the demonstration accounts to DEMO_PASSWORD on a
// database that is already running (production included), without reseeding
// it.
//
// Only the accounts listed in src/lib/demo/accounts.ts are touched, found by
// their identifier; no other user is ever read for writing. Idempotent and non
// destructive: an account whose password already is DEMO_PASSWORD is left as
// it is, so running it twice changes nothing the second time. The hash is the
// one of the application (src/lib/auth/password.ts: argon2id, 19 MiB, 2
// iterations), the same settings as the seed.
//
// Usage:
//   DEMO_PASSWORD=... npx tsx scripts/set-demo-password.ts --dry-run   count what would change
//   DEMO_PASSWORD=... npx tsx scripts/set-demo-password.ts             write
// Add --revoke-sessions to also sign out every open session of the demo
// accounts, for instance after the old public password was in use.
// The database is the one of DATABASE_URL (.env, or set on the command line
// for production). DEMO_PASSWORD must be set: there is no fallback here.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { DEMO_ACCOUNTS } from "../src/lib/demo/accounts";

// The sign in form accepts at most 200 characters; a shared password handed
// to outside reviewers should not be short.
const MIN_LENGTH = 12;
const MAX_LENGTH = 200;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("DEMO_PASSWORD must be set: the new password of the demo accounts");
  if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
    throw new Error(`DEMO_PASSWORD must hold ${MIN_LENGTH} to ${MAX_LENGTH} characters`);
  }
  const dryRun = process.argv.includes("--dry-run");
  const revokeSessions = process.argv.includes("--revoke-sessions");
  const usernames = DEMO_ACCOUNTS.map((a) => a.username);
  const host = new URL(url).hostname;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    const users = await db.user.findMany({ where: { username: { in: usernames } }, select: { id: true, username: true, passwordHash: true } });
    const found = new Set(users.map((u) => u.username));
    const missing = usernames.filter((u) => !found.has(u));

    const stale: { id: string; username: string }[] = [];
    for (const user of users) {
      if (!(await verifyPassword(user.passwordHash, password))) stale.push({ id: user.id, username: user.username });
    }
    const openSessions = revokeSessions
      ? await db.session.count({ where: { userId: { in: users.map((u) => u.id) }, revokedAt: null, expiresAt: { gt: new Date() } } })
      : 0;

    if (dryRun) {
      console.log(`[dry run] ${host}: ${stale.length} demo account(s) would be updated, ${users.length - stale.length} already up to date, ${missing.length} not found.`);
      if (revokeSessions) console.log(`[dry run] ${openSessions} open session(s) of the demo accounts would be revoked.`);
      if (missing.length) console.log(`Not found: ${missing.join(", ")}`);
      return;
    }

    // Hashes first, then one short transaction with no slow work inside.
    const updates = await Promise.all(stale.map(async (u) => ({ ...u, passwordHash: await hashPassword(password) })));
    const now = new Date();
    const revoked = await db.$transaction(async (tx) => {
      for (const u of updates) {
        // Both the id and the identifier must match: nothing else is written.
        await tx.user.update({ where: { id: u.id, username: u.username }, data: { passwordHash: u.passwordHash } });
      }
      if (!revokeSessions) return 0;
      const result = await tx.session.updateMany({
        where: { userId: { in: users.map((u) => u.id) }, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      return result.count;
    });

    console.log(`${host}: updated ${updates.length} demo account(s), ${users.length - updates.length} already up to date, ${missing.length} not found.`);
    if (revokeSessions) console.log(`Revoked ${revoked} open session(s) of the demo accounts.`);
    if (missing.length) console.log(`Not found: ${missing.join(", ")}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

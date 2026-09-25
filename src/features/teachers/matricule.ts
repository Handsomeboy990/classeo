import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// "ENS-" + five digits, as the seeded teacher matricules. Only numeric
// matricules count: a single "ENS-X..." imported by hand sorts last and
// would otherwise restart the sequence at 1, on a matricule already taken.
export async function nextTeacherMatricule(client: Prisma.TransactionClient | typeof db = db) {
  const taken = await client.teacher.findMany({ where: { matricule: { startsWith: "ENS-" } }, select: { matricule: true } });
  const seq = taken.reduce((max, t) => (/^ENS-\d+$/.test(t.matricule) ? Math.max(max, Number.parseInt(t.matricule.slice(4), 10)) : max), 0);
  return `ENS-${String(seq + 1).padStart(5, "0")}`;
}

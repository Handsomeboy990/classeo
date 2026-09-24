import "server-only";

import { headers } from "next/headers";

import type { Prisma } from "@/generated/prisma/client";
import { clientIp, type CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

type AuditEntry = {
  action: string; // "create", "update", "delete", "export", "login", "publish"...
  resource: string;
  resourceId?: string | null;
  summary: string; // human readable, shown in the activity log
  metadata?: Prisma.InputJsonValue;
  schoolId?: string | null;
};

// Writes never fail the business action: an audit failure is logged and the
// user's operation stands.
export async function audit(user: CurrentUser | null, entry: AuditEntry) {
  try {
    const h = await headers();
    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        summary: entry.summary,
        metadata: entry.metadata,
        schoolId: entry.schoolId ?? user?.scope.schoolId ?? null,
        ip: clientIp(h),
      },
    });
  } catch (error) {
    console.error("audit write failed", error);
  }
}

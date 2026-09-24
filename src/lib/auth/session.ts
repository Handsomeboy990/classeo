import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";

import type { PermissionCode } from "./permissions";

export const SESSION_COOKIE = "classeo_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // one working day

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
      ip: clientIp(h),
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    },
  });
  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: h.get("x-forwarded-proto") === "https" || !!process.env.VERCEL || process.env.FORCE_HTTPS === "true",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const sid = await readSessionId(jar.get(SESSION_COOKIE)?.value);
  if (sid) await db.session.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(SESSION_COOKIE);
}

export async function readSessionId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

export function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const userInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  school: { select: { id: true, name: true, communeId: true, commune: { select: { departmentId: true } } } },
  commune: { select: { id: true, name: true, departmentId: true } },
  department: { select: { id: true, name: true } },
  teacher: { select: { id: true } },
  student: { select: { id: true } },
  guardian: { select: { id: true } },
} as const;

export type CurrentUser = Awaited<ReturnType<typeof loadUser>>;

async function loadUser(sessionId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: userInclude } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) return null;
  const u = session.user;
  return {
    id: u.id,
    sessionId: session.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    mustChangePassword: u.mustChangePassword,
    role: { id: u.role.id, code: u.role.code, name: u.role.name },
    permissions: new Set(u.role.permissions.map((rp) => rp.permission.code as PermissionCode)),
    scope: {
      level: u.scopeLevel,
      departmentId: u.departmentId ?? u.commune?.departmentId ?? u.school?.commune.departmentId ?? null,
      communeId: u.communeId ?? u.school?.communeId ?? null,
      schoolId: u.schoolId,
      label: u.school?.name ?? u.commune?.name ?? u.department?.name ?? "Bénin",
    },
    teacherId: u.teacher?.id ?? null,
    studentId: u.student?.id ?? null,
    guardianId: u.guardian?.id ?? null,
  };
}

// Deduplicated per request: every server component and action calling it in
// the same render shares one database lookup.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const sid = await readSessionId(token);
  if (!sid) return null;
  return loadUser(sid);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

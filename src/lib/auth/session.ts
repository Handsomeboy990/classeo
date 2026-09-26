import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { cached, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { scopeCycles } from "@/lib/domain/chains";

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

// Forwarding headers are client controlled unless a proxy we trust rewrites
// them. Vercel overwrites X-Forwarded-For with the real client address; any
// other reverse proxy must be declared with TRUST_PROXY=true. Otherwise every
// request shares one key, which keeps the rate limit impossible to bypass.
export function clientIp(h: Headers) {
  if (!process.env.VERCEL && process.env.TRUST_PROXY !== "true") return "direct";
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// A role's permissions change only through the rights matrix, which
// invalidates tags.roles. Caching them avoids reading about eighty rows on
// every request.
const rolePermissions = cached(
  async (roleId: string) => {
    const rows = await db.rolePermission.findMany({ where: { roleId }, select: { permission: { select: { code: true } } } });
    return rows.map((r) => r.permission.code);
  },
  ["role-permissions"],
  { tags: [tags.roles], revalidate: 3600 },
);

const userInclude = {
  role: { select: { id: true, code: true, name: true } },
  school: { select: { id: true, name: true, logoFileId: true, communeId: true, cycle: true, periodicity: true, commune: { select: { departmentId: true } } } },
  commune: { select: { id: true, name: true, departmentId: true } },
  department: { select: { id: true, name: true } },
  // One appointment per school where the person teaches.
  teachers: {
    where: { isActive: true },
    select: { id: true, school: { select: { id: true, name: true, logoFileId: true, communeId: true, cycle: true, periodicity: true, commune: { select: { departmentId: true } } } } },
  },
  student: { select: { id: true } },
  guardian: { select: { id: true } },
} as const;

export type CurrentUser = Awaited<ReturnType<typeof loadUser>>;

// A parent or a student has no territory: their scope is the school, or the
// schools, of the children they follow (their own for a student), in the
// active year. Never "Bénin".
async function familyScopeLabel(userId: string) {
  const rows = await db.enrollment.findMany({
    where: {
      academicYear: { isActive: true },
      status: "ACTIVE",
      student: { OR: [{ userId }, { guardians: { some: { guardian: { userId } } } }] },
    },
    select: { school: { select: { name: true } } },
  });
  const names = [...new Set(rows.map((r) => r.school.name))].sort((a, b) => a.localeCompare(b, "fr"));
  if (!names.length) return "Espace famille";
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

async function loadUser(sessionId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: userInclude } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) return null;
  const u = session.user;
  // The school the session works in: the one chosen at sign in (or later
  // from the school switcher) when the account holds it, otherwise the
  // account's own school, otherwise its first teaching appointment.
  const schools = [
    ...(u.school ? [u.school] : []),
    ...u.teachers.map((t) => t.school).filter((sc) => sc.id !== u.school?.id),
  ];
  const active = schools.find((sc) => sc.id === session.activeSchoolId) ?? schools[0] ?? null;
  const teacher = u.teachers.find((t) => t.school.id === active?.id) ?? null;
  return {
    id: u.id,
    sessionId: session.id,
    username: u.username,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    gender: u.gender,
    mustChangePassword: u.mustChangePassword,
    role: { id: u.role.id, code: u.role.code, name: u.role.name },
    permissions: new Set((await rolePermissions(u.role.id)) as PermissionCode[]),
    scope: {
      level: u.scopeLevel,
      departmentId: u.departmentId ?? u.commune?.departmentId ?? active?.commune.departmentId ?? null,
      communeId: u.communeId ?? active?.communeId ?? null,
      schoolId: u.scopeLevel === "SCHOOL" ? (active?.id ?? null) : u.schoolId,
      label: u.scopeLevel === "SELF" ? await familyScopeLabel(u.id) : (active?.name ?? u.commune?.name ?? u.department?.name ?? "Bénin"),
      // Logo of the active school, shown in the top bar.
      logoFileId: u.scopeLevel === "SCHOOL" ? (active?.logoFileId ?? null) : null,
      // Administrative chain of a national or departmental account, and the
      // school cycles the territory is limited to (null: every cycle).
      chain: u.chain,
      cycles: scopeCycles(u.scopeLevel, u.chain),
      // Cycle and evaluation periodicity of the school the session works in.
      cycle: u.scopeLevel === "SCHOOL" ? (active?.cycle ?? null) : null,
      periodicity: u.scopeLevel === "SCHOOL" ? (active?.periodicity ?? null) : null,
    },
    // Schools the account can switch between (several for a teacher).
    schools: schools.map((sc) => ({ id: sc.id, name: sc.name, logoFileId: sc.logoFileId })),
    activeSchoolId: u.scopeLevel === "SCHOOL" ? (active?.id ?? null) : null,
    teacherId: teacher?.id ?? null,
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

// Number of schools an account works in (its own school and its teaching
// appointments). Above one, the account chooses its school after sign in.
export async function accountSchoolCount(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { schoolId: true, teachers: { where: { isActive: true }, select: { schoolId: true } } } });
  if (!u) return 0;
  return new Set([...(u.schoolId ? [u.schoolId] : []), ...u.teachers.map((t) => t.schoolId)]).size;
}

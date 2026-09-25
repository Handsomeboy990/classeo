import "server-only";

import { schoolWhere } from "@/lib/auth/scope";
import type { CurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { invalidate, tags } from "@/lib/cache";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { formatDate } from "@/lib/utils";

import { endOfBeninDay } from "./rules";

type User = NonNullable<CurrentUser>;

// Server only on purpose: it trusts the user it receives, so it must never
// be exported from a "use server" file, where any export becomes callable
// from the browser. Callers are actions that already authorized the user.

// Directors of the schools concerned, told that they may write again.
async function directorsOf(schoolIds: string[]) {
  const users = await db.user.findMany({
    where: { isActive: true, scopeLevel: "SCHOOL", schoolId: { in: schoolIds }, role: { code: "SCHOOL_DIRECTOR" } },
    select: { id: true },
    take: 1000,
  });
  return users.map((u) => u.id);
}

// Keeps a closed year writable until a date, for every school or for chosen
// schools. Also used when the ministry approves a YEAR_EXTENSION request.
export async function grantExtension(
  user: User,
  input: { academicYearId: string; schoolIds: string[] | null; until: string; reason: string; requestId?: string | null },
) {
  const year = await db.academicYear.findUnique({ where: { id: input.academicYearId }, select: { id: true, label: true, startDate: true } });
  if (!year) throw new DomainError("Année scolaire introuvable.");
  const until = endOfBeninDay(input.until);
  const now = new Date();
  if (until < now) throw new DomainError("La date de fin de prolongation doit être aujourd'hui ou plus tard.");
  if (until.getTime() - now.getTime() > 180 * 86_400_000) throw new DomainError("Une prolongation dure six mois au plus.");
  if (until < year.startDate) throw new DomainError("La prolongation doit finir après le début de l'année.");

  let schools: { id: string; name: string }[] = [];
  if (input.schoolIds) {
    const ids = [...new Set(input.schoolIds)];
    schools = await db.school.findMany({ where: { AND: [{ id: { in: ids } }, schoolWhere(user)] }, select: { id: true, name: true } });
    if (schools.length !== ids.length) throw new DomainError("Un établissement choisi est introuvable ou hors de votre périmètre.");
  }

  const created = await db.$transaction(async (tx) => {
    // A new extension replaces the running one of the same target.
    await tx.yearExtension.updateMany({
      where: { academicYearId: year.id, status: "ACTIVE", schoolId: input.schoolIds ? { in: schools.map((s) => s.id) } : null },
      data: { status: "ENDED" },
    });
    const rows = input.schoolIds ? schools.map((s) => ({ schoolId: s.id })) : [{ schoolId: null }];
    await tx.yearExtension.createMany({
      data: rows.map((r) => ({ ...r, academicYearId: year.id, until, reason: input.reason, grantedById: user.id, requestId: input.requestId ?? null })),
    });
    return rows.length;
  });

  const who = input.schoolIds ? (schools.length === 1 ? schools[0]!.name : `${schools.length} établissements`) : "tous les établissements";
  await audit(user, {
    action: "approve",
    resource: "calendar",
    resourceId: year.id,
    summary: `Prolongation de l'année ${year.label} jusqu'au ${formatDate(until)} pour ${who}`,
    metadata: { schoolIds: input.schoolIds, until: input.until, requestId: input.requestId ?? null },
    schoolId: schools.length === 1 ? schools[0]!.id : null,
  });
  if (schools.length)
    await notify(await directorsOf(schools.map((s) => s.id)), {
      kind: "request",
      title: `Année ${year.label} prolongée`,
      body: `Votre établissement peut compléter l'année ${year.label} jusqu'au ${formatDate(until)}. Motif : ${input.reason.slice(0, 160)}`,
      link: "/espace/calendrier",
    });
  invalidate(tags.stats, tags.schools);
  return { created, who, until, label: year.label };
}


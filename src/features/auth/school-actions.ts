"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

// The school a session works in, for an account holding several (a teacher
// appointed in two schools). Only a school the account holds is accepted:
// the scope of the session then follows it (session.ts).
export const switchSchool = createAction({
  permission: null,
  schema: z.object({ schoolId: z.string().trim().min(1).max(64), next: z.string().max(300).optional() }),
  handler: async ({ schoolId, next }, user) => {
    const school = user.schools.find((s) => s.id === schoolId);
    if (!school) throw new DomainError("Cet établissement ne fait pas partie de votre compte.");
    const { count } = await db.session.updateMany({ where: { id: user.sessionId, userId: user.id, revokedAt: null }, data: { activeSchoolId: school.id } });
    if (!count) throw new DomainError("Session expirée. Veuillez vous reconnecter.");
    if (user.scope.schoolId !== school.id)
      await audit(user, { action: "switch_school", resource: "user", resourceId: user.id, schoolId: school.id, summary: `Passage à l'établissement ${school.name}` });
    // Same rule as sign in: only a path of the private space, never another
    // site.
    redirect(next && next.startsWith("/espace") && !next.startsWith("//") && !next.startsWith("/espace/choisir-etablissement") ? next : "/espace");
  },
});

"use server";

import { z } from "zod";

import type { ActionState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const schema = z.object({ schoolId: z.string().min(1).max(40) });

// The school a session works in, for accounts attached to several (a
// teacher appointed in two schools). Only a school the account holds can
// be chosen; every page then reads its data through the new scope.
export async function switchSchool(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Session expirée. Veuillez vous reconnecter." };
    const parsed = schema.safeParse(Object.fromEntries(formData));
    const target = parsed.success ? user.schools.find((s) => s.id === parsed.data.schoolId) : undefined;
    if (!target) return { ok: false, message: "Cet établissement ne fait pas partie de votre compte." };
    await db.session.update({ where: { id: user.sessionId }, data: { activeSchoolId: target.id } });
    await audit(user, { action: "switch_school", resource: "school", resourceId: target.id, schoolId: target.id, summary: `Travaille maintenant dans ${target.name}` });
    return { ok: true, message: `Vous travaillez maintenant dans ${target.name}.` };
  } catch (error) {
    console.error("school switch failed", error);
    return { ok: false, message: "Une erreur inattendue est survenue. Réessayez dans un instant." };
  }
}

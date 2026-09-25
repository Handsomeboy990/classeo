import { School } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { StudentAvatar } from "@/features/students/components/student-avatar";
import type { CurrentUser } from "@/lib/auth/session";
import { isEnabled } from "@/lib/features";

import { awaitingGuardian } from "../queries";

// Transfers waiting for the parent's yes or no, at the top of the family
// space: big targets, one sentence each.
export async function GuardianTransferRequests({ user }: { user: NonNullable<CurrentUser> }) {
  if (!user.guardianId || !(await isEnabled("students.transfers"))) return null;
  const rows = await awaitingGuardian(user);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="transfer-requests" className="mb-6 flex flex-col gap-3">
      <h2 id="transfer-requests" className="flex items-center gap-2 text-xl font-bold">
        <School className="size-5 text-primary" aria-hidden /> Votre réponse est demandée
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((t) => {
          const name = `${t.student.firstName} ${t.student.lastName}`;
          return (
            <li key={t.id} className="flex flex-col gap-3 rounded-card border-2 border-primary bg-primary-soft p-4 sm:flex-row sm:items-center">
              <StudentAvatar name={name} photoFileId={t.student.photoFileId} className="size-12 text-base" />
              <p className="min-w-0 flex-1 text-base">
                <strong>{t.fromSchool.name}</strong> propose que {t.student.firstName} aille à <strong>{t.toSchool.name}</strong> ({t.toSchool.commune.name}).
              </p>
              <ButtonLink href={`/espace/transferts/${t.id}`} size="lg" className="max-sm:w-full">
                Répondre
              </ButtonLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { SchoolPicker } from "@/features/auth/school-picker";
import { requireUser } from "@/lib/auth/session";
import { fileUrl } from "@/lib/files";
import { param } from "@/lib/list";

export const metadata: Metadata = { title: "Choisir l'établissement" };

// Shown after sign in to an account working in several schools, and from
// the switcher of the header and the account sheet. The data of the session
// then follows the chosen school.
export default async function ChooseSchoolPage({ searchParams }: PageProps<"/espace/choisir-etablissement">) {
  const user = await requireUser();
  const next = param(await searchParams, "next");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Choisir l'établissement"
        info="Votre compte travaille dans plusieurs établissements. Choisissez celui où vous travaillez maintenant : classes, élèves et notes seront ceux de cet établissement. Vous pourrez changer à tout moment."
      />
      {user.schools.length ? (
        <SchoolPicker
          schools={user.schools.map((s) => ({ id: s.id, name: s.name, logoUrl: fileUrl(s.logoFileId) }))}
          activeId={user.activeSchoolId}
          next={next && next.startsWith("/espace") && !next.startsWith("//") ? next : undefined}
        />
      ) : (
        <EmptyState title="Aucun établissement" description="Votre compte n'est rattaché à aucun établissement." />
      )}
    </div>
  );
}

import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { ContentForm } from "@/features/contents/content-form";
import { targetOptions } from "@/features/contents/queries";
import { can, requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Nouveau contenu" };

export default async function NewContentPage() {
  const user = await requirePermission("content:create");
  const targets = await targetOptions(user);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Nouveau contenu" description="Annonce, ressource pédagogique ou événement. Le résumé facile à lire et la transcription servent à ceux qui écoutent le texte ou ne l'entendent pas." />
      {targets.length === 0 ? (
        <Alert tone="warning" title="Aucune cible disponible">
          Votre compte n&apos;est rattaché à aucune classe ni à aucun territoire. Contactez votre administrateur.
        </Alert>
      ) : (
        <ContentForm
          canPublish={can(user, "content:publish")}
          targets={targets}
          initial={{
            type: "ANNOUNCEMENT",
            title: "",
            easyRead: "",
            body: "",
            audience: "EVERYONE",
            target: targets.length === 1 ? targets[0]!.value : "",
            mediaType: "NONE",
            mediaUrl: "",
            transcript: "",
            subjectLabel: "",
            eventDate: "",
          }}
        />
      )}
    </div>
  );
}

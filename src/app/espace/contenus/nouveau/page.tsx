import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { ContentForm } from "@/features/contents/content-form";
import { recipientOptions, targetOptions } from "@/features/contents/queries";
import { can, requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Nouveau contenu" };

export default async function NewContentPage() {
  const user = await requirePermission("content:create");
  const [targets, recipients] = await Promise.all([targetOptions(user), recipientOptions(user)]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Nouveau contenu" info="Annonce, ressource pédagogique ou événement. Le résumé facile à lire et la transcription servent à ceux qui écoutent le texte ou ne l'entendent pas." />
      {targets.length === 0 ? (
        <Alert tone="warning" title="Aucune cible disponible">
          Votre compte n&apos;est rattaché à aucune classe ni à aucun territoire. Contactez votre administrateur.
        </Alert>
      ) : (
        <ContentForm
          canPublish={can(user, "content:publish")}
          targets={targets}
          recipients={recipients}
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

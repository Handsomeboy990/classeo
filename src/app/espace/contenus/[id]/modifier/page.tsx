import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/kit/page-header";
import { ContentForm } from "@/features/contents/content-form";
import { getManageableContent, targetLabel, targetOptions } from "@/features/contents/queries";
import { toEventInput, toTickerInput } from "@/features/contents/schema";
import { can, requirePermission } from "@/lib/auth/authorize";
import { targetValue } from "@/lib/domain/content-targeting";

export const metadata: Metadata = { title: "Modifier un contenu" };

export default async function EditContentPage({ params }: PageProps<"/espace/contenus/[id]/modifier">) {
  const user = await requirePermission("content:update");
  const { id } = await params;
  const c = await getManageableContent(user, id);
  if (!c) notFound();

  const current = targetValue(c);
  const options = await targetOptions(user);
  // Keep the current target selectable even when it is wider than the
  // editor's own choices.
  const targets = options.some((o) => o.value === current) ? options : [{ value: current, label: targetLabel(c), group: "Cible actuelle" }, ...options];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Modifier le contenu" description={c.title} />
      <ContentForm
        canPublish={can(user, "content:publish")}
        targets={targets}
        initial={{
          id: c.id,
          status: c.status,
          type: c.type,
          title: c.title,
          easyRead: c.easyRead ?? "",
          body: c.body,
          audience: c.audience,
          target: current,
          mediaType: c.mediaType,
          mediaUrl: c.mediaUrl ?? "",
          transcript: c.transcript ?? "",
          subjectLabel: c.subjectLabel ?? "",
          eventDate: toEventInput(c.eventDate),
          tickerUntil: toTickerInput(c.ticker ? c.tickerUntil : null),
        }}
      />
    </div>
  );
}

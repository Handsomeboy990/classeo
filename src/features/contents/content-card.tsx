import { CalendarClock, Captions, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { ReadAloud } from "@/components/kit/read-aloud";
import { Card } from "@/components/ui/card";
import { AUDIENCE_LABELS } from "@/lib/domain/content-targeting";
import { formatDate, formatDateTime } from "@/lib/utils";

import { ContentActions } from "./content-actions";
import { listenText, StatusBadge, TypeBadge } from "./meta";
import { targetLabel, type ContentRow } from "./queries";

export function ContentCard({
  content: c,
  canEdit,
  canPublish,
  canDelete,
  returnTo,
}: {
  content: ContentRow;
  returnTo: string;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const titleId = `content-${c.id}-title`;
  return (
    <Card aria-labelledby={titleId} className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-2">
          <TypeBadge type={c.type} />
          {c.status !== "PUBLISHED" && <StatusBadge status={c.status} />}
          {c.transcript && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <Captions className="size-4" aria-hidden /> Transcription écrite
            </span>
          )}
        </div>
        <ReadAloud text={listenText(c)} compact label={`Écouter « ${c.title} »`} className="size-11 shrink-0" />
      </div>
      <h2 id={titleId} className="text-lg leading-snug font-bold">
        <Link href={`/espace/contenus/${c.id}`} className="hover:underline focus-visible:underline">
          {c.title}
        </Link>
      </h2>
      {c.easyRead ? <p className="text-base">{c.easyRead}</p> : <p className="line-clamp-3 text-sm text-muted">{c.body}</p>}
      {c.eventDate && (
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          <span className="sr-only">Date de l&apos;événement :</span> {formatDateTime(c.eventDate)}
        </p>
      )}
      <dl className="mt-auto flex flex-col gap-1 text-sm text-muted">
        <div className="flex items-center gap-1.5">
          <dt>
            <MapPin className="size-4" aria-hidden />
            <span className="sr-only">Destinataires</span>
          </dt>
          <dd>{targetLabel(c)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>
            <Users className="size-4" aria-hidden />
            <span className="sr-only">Public</span>
          </dt>
          <dd>{AUDIENCE_LABELS[c.audience]}</dd>
        </div>
        <div>
          <dt className="sr-only">Date</dt>
          <dd>{c.publishedAt ? `Publié le ${formatDate(c.publishedAt)}` : `Créé le ${formatDate(c.createdAt)}`}</dd>
        </div>
      </dl>
      {(canEdit || canPublish || canDelete) && (
        <div className="border-t border-border pt-3">
          <ContentActions id={c.id} title={c.title} status={c.status} canEdit={canEdit} canPublish={canPublish} canDelete={canDelete} returnTo={returnTo} />
        </div>
      )}
    </Card>
  );
}

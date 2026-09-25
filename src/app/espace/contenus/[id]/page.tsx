import { ArrowLeft, CalendarClock, Captions, ExternalLink, MapPin, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadAloud } from "@/components/kit/read-aloud";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentActions } from "@/features/contents/content-actions";
import { listenText, MEDIA_LABELS, StatusBadge, TypeBadge } from "@/features/contents/meta";
import { getVisibleContent, manageableIds, targetLabel } from "@/features/contents/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { AUDIENCE_LABELS } from "@/lib/domain/content-targeting";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Contenu" };

export default async function ContentPage({ params }: PageProps<"/espace/contenus/[id]">) {
  const user = await requirePermission("content:view");
  const { id } = await params;
  const c = await getVisibleContent(user, id);
  if (!c) notFound();
  const manage = (await manageableIds(user, [c.id])).has(c.id);

  return (
    <article aria-labelledby="content-title" className="max-w-3xl">
      <Link href="/espace/contenus" className="mb-4 inline-flex h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les annonces et ressources
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={c.type} />
        {c.status !== "PUBLISHED" && <StatusBadge status={c.status} />}
        {c.subjectLabel && <span className="text-sm text-muted">{c.subjectLabel}</span>}
      </div>
      <h1 id="content-title" className="mt-3 text-2xl font-bold sm:text-3xl">
        {c.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ReadAloud text={listenText(c)} label="Écouter ce contenu" className="h-12 px-4 text-base" />
        {manage && (
          <ContentActions
            id={c.id}
            title={c.title}
            status={c.status}
            canEdit={can(user, "content:update")}
            canPublish={can(user, "content:publish")}
            canDelete={can(user, "content:delete")}
            afterDelete="/espace/contenus"
          />
        )}
      </div>

      {c.easyRead && (
        <section aria-labelledby="easy-read-title" className="mt-6 rounded-card border-l-4 border-primary bg-primary-soft px-5 py-4">
          <h2 id="easy-read-title" className="text-sm font-bold tracking-wide text-primary uppercase">
            En bref, facile à lire
          </h2>
          <p className="mt-1 text-lg">{c.easyRead}</p>
        </section>
      )}

      {c.eventDate && (
        <p className="mt-6 flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-5 text-primary" aria-hidden />
          <span>
            <span className="sr-only">Date de l&apos;événement : </span>
            {formatDateTime(c.eventDate)}
          </span>
        </p>
      )}

      <div className="mt-6 text-base leading-relaxed whitespace-pre-line">{c.body}</div>

      {c.mediaType !== "NONE" && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{MEDIA_LABELS[c.mediaType]}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {c.mediaUrl && c.mediaType === "AUDIO" && (
              // preload="none": nothing is downloaded until the reader presses play.
              <audio controls preload="none" src={c.mediaUrl} className="w-full" aria-describedby={c.transcript ? "transcript-title" : undefined}>
                <a href={c.mediaUrl}>Télécharger l&apos;audio</a>
              </audio>
            )}
            {c.mediaUrl && c.mediaType === "VIDEO" && (
              <video controls preload="none" src={c.mediaUrl} className="w-full rounded-lg bg-black" aria-describedby={c.transcript ? "transcript-title" : undefined}>
                <a href={c.mediaUrl}>Télécharger la vidéo</a>
              </video>
            )}
            {c.mediaUrl?.startsWith("/") && c.mediaType === "IMAGE" && (
              // Same origin images only: the content security policy blocks
              // other origins, the link below still opens them.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.mediaUrl} alt={c.easyRead ?? c.title} loading="lazy" className="max-h-96 w-auto rounded-lg" />
            )}
            {c.mediaUrl && (
              <a href={c.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
                <ExternalLink className="size-4" aria-hidden /> Ouvrir le {MEDIA_LABELS[c.mediaType].toLowerCase()} dans un nouvel onglet
              </a>
            )}
            {!c.mediaUrl && (c.mediaType === "AUDIO" || c.mediaType === "VIDEO") && (
              <p className="text-sm text-muted">Le fichier n&apos;est pas en ligne. La transcription ci-dessous en donne le contenu complet.</p>
            )}
          </CardBody>
        </Card>
      )}

      {c.transcript && (
        <section aria-labelledby="transcript-title" className="mt-6 rounded-card border border-border bg-surface px-5 py-4">
          <h2 id="transcript-title" className="flex items-center gap-2 text-lg font-bold">
            <Captions className="size-5" aria-hidden /> Transcription
          </h2>
          <p className="mt-1 text-sm text-muted">Le texte de tout ce qui est dit dans le média, pour les personnes sourdes ou malentendantes.</p>
          <p className="mt-3 leading-relaxed whitespace-pre-line">{c.transcript}</p>
          <ReadAloud text={c.transcript} label="Écouter la transcription" className="mt-3" />
        </section>
      )}

      <dl className="mt-8 grid gap-3 border-t border-border pt-6 text-sm sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-1.5 font-semibold">
            <UserRound className="size-4" aria-hidden /> Auteur
          </dt>
          <dd className="mt-1 text-muted">
            {c.author.firstName} {c.author.lastName}, {c.author.role.name}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold">
            <MapPin className="size-4" aria-hidden /> Destinataires
          </dt>
          <dd className="mt-1 text-muted">{targetLabel(c)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold">
            <Users className="size-4" aria-hidden /> Public
          </dt>
          <dd className="mt-1 text-muted">
            {AUDIENCE_LABELS[c.audience]}, {c.publishedAt ? `publié le ${formatDate(c.publishedAt)}` : `créé le ${formatDate(c.createdAt)}`}
          </dd>
        </div>
      </dl>
    </article>
  );
}

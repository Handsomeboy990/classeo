import { ArrowLeft, CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadAloud } from "@/components/kit/read-aloud";
import { Card, CardBody } from "@/components/ui/card";
import { AutoRefresh } from "@/features/messages/auto-refresh";
import { Composer } from "@/features/messages/composer";
import { getThread, markThreadRead } from "@/features/messages/queries";
import { ThreadScroller } from "@/features/messages/thread-scroller";
import { VoicePlayer } from "@/features/messages/voice-player";
import { can, requirePermission } from "@/lib/auth/authorize";
import { receipt } from "@/lib/domain/institutions";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: PageProps<"/espace/messages/[id]">) {
  const user = await requirePermission("message:view");
  const { id } = await params;
  const thread = await getThread(user, id);
  // Non participants get the same answer as a missing thread.
  if (!thread) notFound();
  await markThreadRead(user, thread);

  const { others, messages, me } = thread;
  const onBehalf = me && me.kind !== "PERSON" ? me.name : null;

  // Phone: a chat screen sized to the window between the app bar and the tab
  // bar. The thread scrolls on its own, the composer stays at the bottom,
  // right above the tab bar, and the page itself does not scroll (the shell
  // drops its bottom padding for data-chat, see globals.css). With very large
  // text the window is too short for all of it: the page scrolls again, the
  // thread keeps half the height and the composer sticks above the tab bar.
  return (
    <div data-chat className="max-w-3xl max-lg:flex max-lg:h-(--chat-h) max-lg:flex-col max-lg:[html[data-text=xl]_&]:h-auto max-lg:[html[data-text=xxl]_&]:h-auto">
      <Link href="/espace/messages" className="mb-3 inline-flex h-11 max-lg:hidden items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Toutes les conversations
      </Link>
      <h1 className="text-xl leading-tight font-bold text-balance sm:text-3xl">{thread.subject}</h1>
      <p className="mt-1 text-sm text-muted max-lg:line-clamp-2 sm:text-base">
        {onBehalf ? `${onBehalf} avec ` : "Avec "}
        {others.length ? others.map((o) => (o.kind === "PERSON" ? `${o.name} (${o.detail})` : o.name)).join(", ") : "personne d'autre"}
      </p>
      {/* Read receipts of the other side for the last message of this side. */}
      {thread.lastMine && others.length > 0 && (
        <ul aria-label="Lecture par les destinataires" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs max-lg:hidden">
          {others.map((o) => {
            const r = receipt(thread.lastMine, o.lastReadAt);
            return (
              <li key={o.userId} className={cn("inline-flex items-center gap-1", r === "read" ? "font-semibold text-primary" : "text-muted")}>
                {r === "read" && <CheckCheck className="size-4" aria-hidden />}
                {r === "read" ? `Lu par ${o.name} le ${formatDateTime(o.lastReadAt!)}` : `Pas encore lu par ${o.name}`}
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-6 max-lg:mt-3 max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col">
        <ThreadScroller count={messages.length} className="max-lg:max-h-none max-lg:min-h-0 max-lg:flex-1 max-lg:[html[data-text=xl]_&]:max-h-[50dvh] max-lg:[html[data-text=xxl]_&]:max-h-[50dvh] max-lg:[html[data-text=xl]_&]:flex-none max-lg:[html[data-text=xxl]_&]:flex-none">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted">Aucun message pour le moment.</p>
          ) : (
            <ol role="log" aria-live="polite" aria-label="Messages de la conversation" className="flex flex-col gap-4">
              {messages.map((m) => {
                const sender = m.mine ? "Vous" : m.author;
                // In an institutional thread, who wrote and for which side.
                const signature = thread.institutional && m.on ? `${sender}, ${m.on}` : sender;
                return (
                  <li key={m.id} className={cn("flex", m.mySide ? "justify-end" : "justify-start")}>
                    <article
                      aria-label={`Message de ${signature}`}
                      className={cn("max-w-[85%] rounded-2xl border px-4 py-3", m.mySide ? "border-primary/30 bg-primary-soft" : "border-border bg-surface-2")}
                    >
                      <header className="flex items-center gap-2">
                        <p className="text-sm font-bold">
                          {sender}
                          {thread.institutional && m.on && <span className="block text-xs font-semibold text-muted">{m.on}</span>}
                        </p>
                        <time dateTime={m.createdAt.toISOString()} className="text-xs text-muted">
                          {formatDateTime(m.createdAt)}
                        </time>
                        {!m.audio && <ReadAloud text={`${m.mine ? "Vous avez écrit" : `${signature} a écrit`} : ${m.body}`} compact label={`Écouter le message de ${sender}`} className="ml-auto size-10 shrink-0" />}
                      </header>
                      {m.audio ? (
                        <VoicePlayer src={m.audio.url} durationMs={m.audio.durationMs} label={`message vocal de ${sender}`} className="mt-2 w-64 max-w-full" />
                      ) : (
                        <p className="mt-1 text-base whitespace-pre-line">{m.body}</p>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </ThreadScroller>
        {can(user, "message:create") && (
          <CardBody data-action-bar className="border-t border-border max-lg:sticky max-lg:bottom-(--tab-bar-space) max-lg:z-10 max-lg:shrink-0 max-lg:rounded-b-card max-lg:bg-surface max-lg:py-3">
            {onBehalf && <p className="mb-2 text-xs text-muted">Vous répondez au nom de {onBehalf}. Votre nom figure sur le message.</p>}
            <Composer conversationId={thread.id} showQuick={!!user.guardianId} />
          </CardBody>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted max-lg:sr-only">Les nouveaux messages s&apos;affichent automatiquement toutes les 15 secondes.</p>
      <AutoRefresh seconds={15} />
    </div>
  );
}

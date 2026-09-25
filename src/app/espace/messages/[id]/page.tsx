import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReadAloud } from "@/components/kit/read-aloud";
import { Card, CardBody } from "@/components/ui/card";
import { AutoRefresh } from "@/features/messages/auto-refresh";
import { Composer } from "@/features/messages/composer";
import { getThread, markThreadRead } from "@/features/messages/queries";
import { roleLabel } from "@/features/messages/role-label";
import { ThreadScroller } from "@/features/messages/thread-scroller";
import { can, requirePermission } from "@/lib/auth/authorize";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: PageProps<"/espace/messages/[id]">) {
  const user = await requirePermission("message:view");
  const { id } = await params;
  const thread = await getThread(user, id);
  // Non participants get the same answer as a missing thread.
  if (!thread) notFound();
  await markThreadRead(user, thread.id);

  const others = thread.participants.filter((p) => p.userId !== user.id);
  const messages = [...thread.messages].reverse();

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
        Avec{" "}
        {others.length
          ? others.map((o) => `${o.user.firstName} ${o.user.lastName} (${[roleLabel(o.user.role.name, o.user.gender), o.user.school?.name].filter(Boolean).join(", ")})`).join(", ")
          : "personne d'autre"}
      </p>

      <Card className="mt-6 max-lg:mt-3 max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col">
        <ThreadScroller count={messages.length} className="max-lg:max-h-none max-lg:min-h-0 max-lg:flex-1 max-lg:[html[data-text=xl]_&]:max-h-[50dvh] max-lg:[html[data-text=xxl]_&]:max-h-[50dvh] max-lg:[html[data-text=xl]_&]:flex-none max-lg:[html[data-text=xxl]_&]:flex-none">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted">Aucun message pour le moment.</p>
          ) : (
            <ol role="log" aria-live="polite" aria-label="Messages de la conversation" className="flex flex-col gap-4">
              {messages.map((m) => {
                const mine = m.senderId === user.id;
                const sender = mine ? "Vous" : `${m.sender.firstName} ${m.sender.lastName}`;
                return (
                  <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <article
                      aria-label={`Message de ${sender}`}
                      className={cn("max-w-[85%] rounded-2xl border px-4 py-3", mine ? "border-primary/30 bg-primary-soft" : "border-border bg-surface-2")}
                    >
                      <header className="flex items-center gap-2">
                        <p className="text-sm font-bold">{sender}</p>
                        <time dateTime={m.createdAt.toISOString()} className="text-xs text-muted">
                          {formatDateTime(m.createdAt)}
                        </time>
                        <ReadAloud text={`${mine ? "Vous avez écrit" : `${sender} a écrit`} : ${m.body}`} compact label={`Écouter le message de ${sender}`} className="ml-auto size-10 shrink-0" />
                      </header>
                      <p className="mt-1 text-base whitespace-pre-line">{m.body}</p>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </ThreadScroller>
        {can(user, "message:create") && (
          <CardBody data-action-bar className="border-t border-border max-lg:sticky max-lg:bottom-(--tab-bar-space) max-lg:z-10 max-lg:shrink-0 max-lg:rounded-b-card max-lg:bg-surface max-lg:py-3">
            <Composer conversationId={thread.id} showQuick={!!user.guardianId} />
          </CardBody>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted max-lg:sr-only">Les nouveaux messages s&apos;affichent automatiquement toutes les 15 secondes.</p>
      <AutoRefresh seconds={15} />
    </div>
  );
}

import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewConversation } from "@/features/messages/new-conversation";
import { allowedContacts, listConversations } from "@/features/messages/queries";
import { roleLabel } from "@/features/messages/role-label";
import { can, requirePermission } from "@/lib/auth/authorize";
import { excerpt, isUnread } from "@/lib/domain/messaging";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Messagerie" };

export default async function MessagesPage() {
  const user = await requirePermission("message:view");
  const canWrite = can(user, "message:create");
  const [conversations, contacts] = await Promise.all([listConversations(user), canWrite ? allowedContacts(user) : Promise.resolve([])]);
  const unreadCount = conversations.filter((c) => isUnread(c.messages[0], c.participants.find((p) => p.userId === user.id)?.lastReadAt, user.id)).length;

  return (
    <>
      <PageHeader
        title="Messagerie"
        description={unreadCount ? `${unreadCount} conversation${unreadCount > 1 ? "s" : ""} avec un nouveau message.` : "Conversations avec l'école, les enseignants et les familles."}
        actions={canWrite && <NewConversation contacts={contacts} showQuick={!!user.guardianId} />}
      />
      <Card>
        {conversations.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="size-7" />}
            title="Aucune conversation"
            description={canWrite ? "Commencez une conversation avec le bouton « Nouvelle conversation »." : "Vos conversations apparaîtront ici."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => {
              const me = c.participants.find((p) => p.userId === user.id);
              const others = c.participants.filter((p) => p.userId !== user.id);
              const last = c.messages[0];
              const unread = isUnread(last, me?.lastReadAt, user.id);
              const names = others.map((o) => `${o.user.firstName} ${o.user.lastName}`).join(", ") || "Vous seul";
              return (
                <li key={c.id}>
                  <Link
                    href={`/espace/messages/${c.id}`}
                    className={cn("flex min-h-20 items-start gap-3 px-5 py-4 hover:bg-surface-2 focus-visible:bg-surface-2", unread && "bg-primary-soft/50")}
                  >
                    <Avatar name={names} className="mt-0.5 size-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("truncate", unread ? "font-bold" : "font-semibold")}>{names}</span>
                        {others[0] && <span className="text-xs text-muted">{roleLabel(others[0].user.role.name, others[0].user.gender)}</span>}
                        {unread && (
                          <Badge tone="success" className="ml-auto">
                            <span className="size-2 rounded-full bg-current" aria-hidden /> Nouveau
                          </Badge>
                        )}
                      </div>
                      <p className={cn("mt-0.5 truncate text-sm", unread ? "font-semibold" : "text-muted")}>{c.subject}</p>
                      {last && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {last.senderId === user.id ? "Vous : " : ""}
                          {excerpt(last.body, 90)}
                        </p>
                      )}
                    </div>
                    {last && <time dateTime={last.createdAt.toISOString()} className="shrink-0 text-xs text-muted">{formatDateTime(last.createdAt)}</time>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

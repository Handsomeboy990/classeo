import { Building2, CheckCheck, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NewConversation } from "@/features/messages/new-conversation";
import { allowedContacts, institutionDirectory, institutionOf, listConversations } from "@/features/messages/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { institutionName, receipt } from "@/lib/domain/institutions";
import { excerpt } from "@/lib/domain/messaging";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Messagerie" };

export default async function MessagesPage({ searchParams }: PageProps<"/espace/messages">) {
  const user = await requirePermission("message:view");
  const canWrite = can(user, "message:create");
  const [conversations, contacts, institutions] = await Promise.all([
    listConversations(user),
    canWrite ? allowedContacts(user) : Promise.resolve([]),
    canWrite ? institutionDirectory(user) : Promise.resolve([]),
  ]);
  const unreadCount = conversations.filter((c) => c.unread).length;
  const acting = institutionOf(user);
  const sp = await searchParams;
  const sent = Number(typeof sp.envoye === "string" ? sp.envoye : 0);

  return (
    <>
      <PageHeader
        title="Messagerie"
        description={
          unreadCount
            ? `${unreadCount} conversation${unreadCount > 1 ? "s" : ""} avec un nouveau message.`
            : acting
              ? "Vos conversations et celles de votre établissement ou service avec les autres structures."
              : "Conversations avec l'école, les enseignants et les familles."
        }
        actions={canWrite && <NewConversation contacts={contacts} institutions={institutions} sender={acting ? institutionName(acting.kind, user.scope.label) : null} showQuick={!!user.guardianId} />}
      />
      {Number.isInteger(sent) && sent > 1 && (
        <Alert tone="success" className="mb-4">
          Message envoyé à {formatNumber(sent)} destinataires : une conversation chacun. La mention « Lu » apparaît dès qu&apos;un destinataire l&apos;ouvre.
        </Alert>
      )}
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
              const names = c.others.map((o) => o.name).join(", ") || "Vous seul";
              const first = c.others[0];
              const institution = !!first && first.kind !== "PERSON";
              const read = c.lastIsMine && c.others.length === 1 ? receipt(c.last?.createdAt, first?.lastReadAt) : null;
              return (
                <li key={c.id}>
                  <Link
                    href={`/espace/messages/${c.id}`}
                    className={cn("flex min-h-20 items-start gap-3 px-5 py-4 hover:bg-surface-2 focus-visible:bg-surface-2", c.unread && "bg-primary-soft/50")}
                  >
                    {institution ? (
                      <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
                        <Building2 className="size-5" />
                      </span>
                    ) : (
                      <Avatar name={names} className="mt-0.5 size-11" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("truncate", c.unread ? "font-bold" : "font-semibold")}>{names}</span>
                        {first && <span className="text-xs text-muted">{first.detail}</span>}
                        {c.unread && (
                          <Badge tone="success" className="ml-auto">
                            <span className="size-2 rounded-full bg-current" aria-hidden /> Nouveau
                          </Badge>
                        )}
                      </div>
                      <p className={cn("mt-0.5 truncate text-sm", c.unread ? "font-semibold" : "text-muted")}>{c.subject}</p>
                      {c.me && c.me.kind !== "PERSON" && <p className="mt-0.5 truncate text-xs text-muted">Pour {c.me.name}</p>}
                      {c.last && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {c.last.senderId === user.id ? "Vous : " : c.lastIsMine ? `${c.last.sender.firstName} ${c.last.sender.lastName} : ` : ""}
                          {excerpt(c.last.body, 90)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {c.last && (
                        <time dateTime={c.last.createdAt.toISOString()} className="text-xs text-muted">
                          {formatDateTime(c.last.createdAt)}
                        </time>
                      )}
                      {read && (
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", read === "read" ? "text-primary" : "text-muted")}>
                          {read === "read" ? <CheckCheck className="size-4" aria-hidden /> : null}
                          {read === "read" ? "Lu" : "Pas encore lu"}
                        </span>
                      )}
                    </div>
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

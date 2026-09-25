import { BellOff, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilterLinks } from "@/features/contents/filter-links";
import { notificationKind } from "@/features/notifications/kinds";
import { MarkAllRead, NotificationControls } from "@/features/notifications/notification-controls";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listParams, param } from "@/lib/list";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/espace/notifications">) {
  // Every signed in user has notifications: no permission code, the query is
  // scoped to the owner.
  const user = await requireUser();
  const sp = await searchParams;
  const { page, skip, take, pageSize } = listParams(sp, 30);
  const onlyUnread = param(sp, "filtre") === "non-lues";
  const where = { userId: user.id, ...(onlyUnread ? { readAt: null } : {}) };
  const [rows, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const next = new URLSearchParams();
    if (onlyUnread) next.set("filtre", "non-lues");
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/espace/notifications?${qs}` : "/espace/notifications";
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}.` : "Vous êtes à jour."}
        actions={unread > 0 && <MarkAllRead />}
      />
      <div className="mb-4">
        <FilterLinks
          label="Filtrer les notifications"
          param="filtre"
          current={onlyUnread ? "non-lues" : undefined}
          searchParams={sp}
          basePath="/espace/notifications"
          options={[
            { value: undefined, label: "Toutes" },
            { value: "non-lues", label: `Non lues (${unread})` },
          ]}
        />
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<BellOff className="size-7" />} title={onlyUnread ? "Aucune notification non lue" : "Aucune notification"} description="Les messages, absences, bulletins et annonces qui vous concernent s'afficheront ici." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => {
              const { label, Icon } = notificationKind(n.kind);
              const isUnread = !n.readAt;
              return (
                <li key={n.id} className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", isUnread && "border-l-4 border-l-primary bg-primary-soft/50")}>
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", isUnread ? "bg-primary text-on-primary" : "bg-surface-2 text-muted")} aria-hidden>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{label}</Badge>
                      {isUnread && <Badge tone="success">Non lue</Badge>}
                      <time dateTime={n.createdAt.toISOString()} className="text-xs text-muted">
                        {formatDateTime(n.createdAt)}
                      </time>
                    </div>
                    <p className={cn("mt-1", isUnread ? "font-bold" : "font-semibold")}>{n.title}</p>
                    <p className="text-sm text-muted">{n.body}</p>
                  </div>
                  <NotificationControls id={n.id} title={n.title} unread={isUnread} hasLink={!!n.link} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} sur {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href(page - 1)} aria-label="Page précédente" className="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-2">
                <ChevronLeft className="size-5" aria-hidden />
              </Link>
            )}
            {page < pages && (
              <Link href={href(page + 1)} aria-label="Page suivante" className="inline-flex size-11 items-center justify-center rounded-lg border border-border-strong hover:bg-surface-2">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

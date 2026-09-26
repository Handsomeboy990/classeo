import { ChevronLeft, ChevronRight, Eye, Inbox, LayoutList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { SearchInput } from "@/components/kit/search-input";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ContentCard } from "@/features/contents/content-card";
import { FilterLinks } from "@/features/contents/filter-links";
import { CONTENT_TYPES, type ContentTypeCode } from "@/features/contents/meta";
import { canFollowManaged, listContents, manageableIds } from "@/features/contents/queries";
import { can, requirePermission } from "@/lib/auth/authorize";
import { listParams, param } from "@/lib/list";
import { cn, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Annonces et ressources" };

const TYPE_PARAM: Record<string, ContentTypeCode> = { annonces: "ANNOUNCEMENT", ressources: "RESOURCE", evenements: "EVENT" };
const STATUS_PARAM = { brouillons: "DRAFT", publies: "PUBLISHED", archives: "ARCHIVED" } as const;

export default async function ContentsPage({ searchParams }: PageProps<"/espace/contenus">) {
  const user = await requirePermission("content:view");
  const sp = await searchParams;
  const { q, page, skip, take, pageSize } = listParams(sp, 12);
  const typeKey = param(sp, "type");
  const type = typeKey ? TYPE_PARAM[typeKey] : undefined;
  // Two views: what is addressed to the user (default), and, for authors
  // and supervisors, what they publish or oversee in their territory.
  const isEditor = canFollowManaged(user);
  const managed = isEditor && param(sp, "vue") === "geres";
  const statusKey = param(sp, "statut") as keyof typeof STATUS_PARAM | undefined;
  const status = managed && statusKey ? STATUS_PARAM[statusKey] : undefined;
  const sent = Number(param(sp, "envoye") ?? 0);

  const { rows, total } = await listContents(user, { view: managed ? "managed" : "received", type, status, q, skip, take });
  const editable = await manageableIds(
    user,
    rows.map((r) => r.id),
  );
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const justDeleted = param(sp, "supprime") === "1";
  const returnTo = pageHref(page);

  function pageHref(p: number) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page" && k !== "supprime" && k !== "envoye") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/espace/contenus?${qs}` : "/espace/contenus";
  }

  return (
    <>
      <PageHeader
        title="Annonces et ressources"
        info={
          managed
            ? "Les contenus que vous publiez ou que vous suivez dans votre périmètre, quel que soit leur public."
            : "Les informations qui vous sont destinées, et seulement celles-là. Chaque contenu peut être écouté."
        }
        actions={
          can(user, "content:create") && (
            <ButtonLink href="/espace/contenus/nouveau">
              <Plus aria-hidden /> Nouveau contenu
            </ButtonLink>
          )
        }
      />

      {Number.isInteger(sent) && sent > 1 && (
        <Alert tone="success" className="mb-4">
          Contenu enregistré pour {formatNumber(sent)} destinataires : chacun reçoit son exemplaire.
        </Alert>
      )}
      {justDeleted && (
        <Alert tone="success" className="mb-4">
          Contenu supprimé.
        </Alert>
      )}
      <div className="mb-6 flex flex-col gap-4">
        {isEditor && (
          <FilterLinks
            label="Choisir la vue"
            param="vue"
            current={managed ? "geres" : undefined}
            searchParams={Object.fromEntries(Object.entries(sp).filter(([k]) => k !== "statut"))}
            basePath="/espace/contenus"
            options={[
              { value: undefined, label: "Pour moi", icon: <Inbox aria-hidden /> },
              { value: "geres", label: "Publiés ou suivis", icon: <Eye aria-hidden /> },
            ]}
          />
        )}
        <SearchInput placeholder="Rechercher un contenu…" />
        <FilterLinks
          label="Filtrer par type"
          param="type"
          current={typeKey && type ? typeKey : undefined}
          searchParams={sp}
          basePath="/espace/contenus"
          options={[
            { value: undefined, label: "Tout", icon: <LayoutList aria-hidden /> },
            ...Object.entries(TYPE_PARAM).map(([value, code]) => {
              const { plural, Icon } = CONTENT_TYPES[code];
              return { value, label: plural, icon: <Icon aria-hidden /> };
            }),
          ]}
        />
        {managed && (
          <FilterLinks
            label="Filtrer par statut"
            param="statut"
            current={status ? statusKey : undefined}
            searchParams={sp}
            basePath="/espace/contenus"
            options={[
              { value: undefined, label: "Tous les statuts" },
              { value: "publies", label: "Publiés" },
              { value: "brouillons", label: "Brouillons" },
              { value: "archives", label: "Archivés" },
            ]}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface">
          <EmptyState
            title={q || type || status ? "Aucun contenu ne correspond à votre recherche" : "Aucun contenu pour le moment"}
            description={
              q || type || status
                ? "Essayez un autre mot ou retirez un filtre."
                : managed
                  ? "Les contenus que vous publiez ou suivez apparaîtront ici."
                  : "Les annonces, ressources et événements qui vous sont destinés apparaîtront ici."
            }
          />
        </div>
      ) : (
        <>
          <p className="sr-only" role="status">
            {formatNumber(total)} contenu{total > 1 ? "s" : ""}
          </p>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => {
              const manage = editable.has(c.id);
              return (
                <li key={c.id}>
                  <ContentCard
                    content={c}
                    canEdit={manage && can(user, "content:update")}
                    canPublish={manage && can(user, "content:publish")}
                    canDelete={manage && can(user, "content:delete")}
                    returnTo={returnTo}
                  />
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3 text-sm text-muted">
              <span>
                Page {page} sur {pages}
              </span>
              <div className="flex gap-2">
                <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Page précédente">
                  <ChevronLeft className="size-5" aria-hidden />
                </PageLink>
                <PageLink href={pageHref(page + 1)} disabled={page >= pages} label="Page suivante">
                  <ChevronRight className="size-5" aria-hidden />
                </PageLink>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex size-11 items-center justify-center rounded-lg border border-border-strong";
  if (disabled)
    return (
      <span className={cn(cls, "opacity-40")} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "hover:bg-surface-2")} aria-label={label}>
      {children}
    </Link>
  );
}

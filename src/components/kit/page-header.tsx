import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { InfoTip } from "./info-tip";
import { ReadAloud } from "./read-aloud";

// Title block of every page. The listen button reads the page's main region
// (id="page-content", set by the app shell).
//
// description: the short context of the page, kept visible (a class, a
// period, a matricule). info: what the page is for or how it works, in an
// info bubble beside the title, so the page opens on its content.
//
// Phone: the title with the speaker button beside it, the description
// under, then the actions sharing the full width. From 40rem: title and
// description on the left, speaker and actions aligned on the right.
//
// breadcrumbs: the trail above the title, the page itself last (not a
// link). On a phone only the parent shows, as a back link.
//
// actionsPlacement "below", for pages with many actions (a student file):
// the actions keep their own row under the title up to 100rem, so they never
// squeeze a long name into a narrow column, and join the title row beyond.
export function PageHeader({
  title,
  description,
  info,
  infoSize,
  listen,
  actions,
  readable = true,
  actionsPlacement = "end",
  breadcrumbs,
}: {
  title: string;
  description?: string;
  info?: ReactNode;
  // lg for a longer note (a method), see InfoTip.
  infoSize?: "md" | "lg";
  // A text of its own to speak instead of the page (a spoken summary).
  listen?: { text: string; label: string };
  actions?: ReactNode;
  readable?: boolean;
  actionsPlacement?: "end" | "below";
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const below = actionsPlacement === "below";
  return (
    <>
      {breadcrumbs && breadcrumbs.length > 1 && <Breadcrumbs items={breadcrumbs} />}
      <div
        className={cn(
          "ds-page-header mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3.5 sm:mb-8 sm:gap-y-4",
          below ? "min-[100rem]:grid-cols-[minmax(0,1fr)_auto_auto] min-[100rem]:items-end" : "sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end",
        )}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="min-w-0 text-2xl leading-[1.25] font-bold text-balance text-text lg:text-[1.75rem] lg:leading-[1.2]">{title}</h1>
            {info && (
              <InfoTip label="À propos de cette page" size={infoSize} className="mt-0.5">
                {info}
              </InfoTip>
            )}
          </div>
          {description && <p data-page-detail className="mt-1 max-w-2xl text-sm text-pretty text-muted sm:text-base">{description}</p>}
        </div>
        {listen ? (
          <span className="inline-flex">
            <ReadAloud text={listen.text} label={listen.label} />
            <span className="sr-only">Résumé : {listen.text}</span>
          </span>
        ) : readable ? (
          <ReadAloud targetId="page-content" label="Écouter la page" />
        ) : (
          <span aria-hidden />
        )}
        {actions && (
          <div
            className={cn(
              "col-span-2 flex flex-wrap items-center gap-2 max-sm:[&>*]:grow max-sm:[&>*]:basis-[calc(50%-0.25rem)]",
              below ? "min-[100rem]:col-span-1" : "sm:col-span-1",
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </>
  );
}

// Breadcrumb trail (doc 4.8): 0.8125rem, chevron separators, the current
// page last in the body colour. Phone: the parent only, after a back arrow,
// on a 44 px target.
function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const parent = [...items.slice(0, -1)].reverse().find((i) => i.href);
  return (
    <nav aria-label="Fil d'Ariane" className="mb-2 text-[0.8125rem] text-muted" data-print-hide>
      {parent?.href && (
        <Link href={parent.href} className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 font-semibold hover:text-text sm:hidden">
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          {parent.label}
        </Link>
      )}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 max-sm:hidden">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="inline-flex min-w-0 items-center gap-1">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-text")}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="underline-offset-3 hover:text-text hover:underline">
                  {item.label}
                </Link>
              )}
              {!last && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

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
}) {
  const below = actionsPlacement === "below";
  return (
    <div
      className={cn(
        "ds-page-header mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3.5 sm:mb-8 sm:gap-y-4",
        below ? "min-[100rem]:grid-cols-[minmax(0,1fr)_auto_auto] min-[100rem]:items-end" : "sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="min-w-0 text-[1.625rem] leading-tight font-bold text-balance text-text sm:text-3xl">{title}</h1>
          {info && (
            <InfoTip label={`À propos de la page ${title}`} size={infoSize} className="mt-0.5">
              {info}
            </InfoTip>
          )}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-pretty text-muted sm:text-base">{description}</p>}
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
            "col-span-2 flex flex-wrap items-center gap-2 max-sm:[&>*]:grow",
            below ? "min-[100rem]:col-span-1" : "sm:col-span-1",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

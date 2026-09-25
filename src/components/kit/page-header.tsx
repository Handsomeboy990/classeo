import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ReadAloud } from "./read-aloud";

// Title block of every page. The listen button reads the page's main region
// (id="page-content", set by the app shell).
//
// Phone: the title with the listen button as an icon beside it, the
// description under, then the actions sharing the full width. From 40rem:
// title and description on the left, listen and actions aligned on the
// right.
//
// actionsPlacement "below", for pages with many actions (a student file):
// the actions keep their own row under the title up to 100rem, so they never
// squeeze a long name into a narrow column, and join the title row beyond.
export function PageHeader({
  title,
  description,
  actions,
  readable = true,
  actionsPlacement = "end",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  readable?: boolean;
  actionsPlacement?: "end" | "below";
}) {
  const below = actionsPlacement === "below";
  return (
    <div
      className={cn(
        "mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-4 sm:mb-8",
        below ? "min-[100rem]:grid-cols-[minmax(0,1fr)_auto_auto] min-[100rem]:items-end" : "sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end",
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-bold text-balance text-text sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-pretty text-muted">{description}</p>}
      </div>
      {readable ? <ReadAloud targetId="page-content" label="Écouter la page" compact="mobile" /> : <span aria-hidden />}
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

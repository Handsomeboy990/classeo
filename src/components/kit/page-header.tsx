import type { ReactNode } from "react";

import { ReadAloud } from "./read-aloud";

// Title block of every page. The listen button reads the page's main region
// (id="page-content", set by the app shell).
//
// Phone: the title with the listen button as an icon beside it, the
// description under, then the actions sharing the full width. From 40rem:
// title and description on the left, listen and actions aligned on the
// right.
export function PageHeader({ title, description, actions, readable = true }: { title: string; description?: string; actions?: ReactNode; readable?: boolean }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-4 sm:mb-8 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-bold text-balance text-text sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-pretty text-muted">{description}</p>}
      </div>
      {readable ? <ReadAloud targetId="page-content" label="Écouter la page" compact="mobile" /> : <span aria-hidden />}
      {actions && <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 max-sm:[&>*]:grow">{actions}</div>}
    </div>
  );
}

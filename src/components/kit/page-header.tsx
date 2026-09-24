import type { ReactNode } from "react";

import { ReadAloud } from "./read-aloud";

// Title block of every page. The listen button reads the page's main region
// (id="page-content", set by the app shell).
export function PageHeader({ title, description, actions, readable = true }: { title: string; description?: string; actions?: ReactNode; readable?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-text sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {readable && <ReadAloud targetId="page-content" label="Écouter la page" />}
        {actions}
      </div>
    </div>
  );
}

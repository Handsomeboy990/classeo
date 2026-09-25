import { CloudOff, Inbox, SearchX, ShieldX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function Glyph({ tone = "neutral", children }: { tone?: "neutral" | "danger" | "warning"; children: ReactNode }) {
  const cls = {
    neutral: "bg-surface-2 text-muted ring-border",
    danger: "bg-danger-soft text-danger ring-danger/20",
    warning: "bg-warning-soft text-warning ring-warning/25",
  }[tone];
  return (
    <span className={cn("flex size-12 items-center justify-center rounded-2xl ring-1 ring-inset [&_svg]:size-6", cls)} aria-hidden>
      {children}
    </span>
  );
}

// Two different empty states: "empty" means nothing exists yet (invite to
// create), "no-results" means the search or the filters match nothing
// (invite to change them).
export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = "empty",
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: "empty" | "no-results";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 px-6 py-12 text-center sm:py-14", className)}>
      <Glyph>{icon ?? (variant === "no-results" ? <SearchX /> : <Inbox />)}</Glyph>
      <div className="max-w-md">
        <p className="font-semibold text-balance text-text">{title}</p>
        {description && <p className="mt-1 text-sm text-pretty text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = "Impossible de charger cette page", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <Glyph tone="danger">
        <CloudOff />
      </Glyph>
      <div className="max-w-md">
        <p className="text-lg font-bold text-balance">{title}</p>
        <p className="mt-1 text-sm text-pretty text-muted">{description ?? "Vérifiez votre connexion puis réessayez. Si le problème persiste, contactez l'administrateur."}</p>
      </div>
      {action}
    </div>
  );
}

export function ForbiddenState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <Glyph tone="warning">
        <ShieldX />
      </Glyph>
      <div className="max-w-md">
        <h1 className="text-xl font-bold">Accès refusé</h1>
        <p className="mt-1 text-sm text-pretty text-muted">Votre rôle ne donne pas accès à cette page. Si vous pensez que c&apos;est une erreur, contactez votre administrateur.</p>
      </div>
    </div>
  );
}

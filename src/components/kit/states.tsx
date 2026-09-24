import { FileQuestion, ServerCrash, ShieldX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
        {icon ?? <FileQuestion className="size-7" />}
      </span>
      <div>
        <p className="font-semibold text-text">{title}</p>
        {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = "Impossible de charger cette page", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden>
        <ServerCrash className="size-7" />
      </span>
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-md text-sm text-muted">{description ?? "Vérifiez votre connexion puis réessayez. Si le problème persiste, contactez l'administrateur."}</p>
      {action}
    </div>
  );
}

export function ForbiddenState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning" aria-hidden>
        <ShieldX className="size-7" />
      </span>
      <h1 className="text-xl font-bold">Accès refusé</h1>
      <p className="max-w-md text-sm text-muted">Votre rôle ne donne pas accès à cette page. Si vous pensez que c&apos;est une erreur, contactez votre administrateur.</p>
    </div>
  );
}

import { PowerOff } from "lucide-react";

import { EmptyState } from "@/components/kit/states";

// Shown in place of the transfer pages when the option is switched off.
export function TransfersOff() {
  return (
    <EmptyState
      className="rounded-card border border-border bg-surface"
      icon={<PowerOff className="size-7" />}
      title="Transferts désactivés"
      description="Le ministère a désactivé les transferts d'élèves pour le moment. Les transferts déjà enregistrés restent dans le parcours de chaque élève."
    />
  );
}

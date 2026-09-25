import "server-only";

import { can } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/session";

export function feesTabs(user: NonNullable<CurrentUser>) {
  return [
    { href: "/espace/frais", label: "Vue d'ensemble", show: true },
    { href: "/espace/frais/factures", label: "Factures", show: can(user, "fee:view") },
    { href: "/espace/frais/paiements", label: "Paiements", show: can(user, "payment:view") },
    { href: "/espace/frais/types", label: "Types de frais et échéanciers", show: can(user, "fee:view") },
  ]
    .filter((t) => t.show)
    .map(({ href, label }) => ({ href, label }));
}

import { Info } from "lucide-react";

import { formatDateTime } from "@/lib/utils";

import type { ScopeStatistics } from "../queries";

// How each figure is computed, so a figure can be explained to the jury or a
// partner without reading the code.
export function MethodNote({ stats }: { stats: ScopeStatistics }) {
  return (
    <details className="rounded-card border border-border bg-surface px-5 py-4 text-sm text-muted">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-text">
        <Info className="size-4" aria-hidden /> Méthode de calcul
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>Élèves, filles et handicap : inscriptions actives de l&apos;année {stats.yearLabel ?? "en cours"}.</li>
        <li>Taux d&apos;absence : demi-journées relevées absentes (justifiées ou non) sur l&apos;ensemble des demi-journées relevées cette année. Un retard compte comme une présence.</li>
        <li>
          Réussite et moyenne : bulletins publiés en {stats.previousYearLabel ?? "année précédente"}. La moyenne annuelle d&apos;un élève est la moyenne de ses trois
          trimestres ; le taux de réussite est la part des moyennes annuelles égales ou supérieures à 10/20.
        </li>
        <li>
          {stats.previousYearLabel === stats.yearLabel
            ? "Année close : ses propres bulletins donnent la réussite et la moyenne ; pour une classe, ceux de ses élèves cette année-là."
            : "Pour une classe, les résultats sont ceux obtenus l'an dernier par les élèves qui la composent aujourd'hui."}
        </li>
        <li>Chaque niveau additionne exactement les chiffres de ses subdivisions. Calculé le {formatDateTime(stats.computedAt)}, actualisé à chaque modification.</li>
      </ul>
    </details>
  );
}

import { formatDateTime } from "@/lib/utils";

import type { ScopeStatistics } from "../queries";

// What the statistics page shows and how each figure is computed, so a
// figure can be explained to a partner without reading the code. Shown in
// the info bubble of the page title; phrasing content only (spans), as the
// bubble may sit inside a line of text.
export function MethodNote({ stats }: { stats: ScopeStatistics }) {
  const items = [
    `Élèves, filles et handicap : inscriptions actives de l'année ${stats.yearLabel ?? "en cours"}.`,
    "Taux d'absence : demi-journées relevées absentes (justifiées ou non) sur l'ensemble des demi-journées relevées cette année. Un retard compte comme une présence.",
    `Réussite et moyenne : bulletins publiés en ${stats.previousYearLabel ?? "année précédente"}. La moyenne annuelle d'un élève suit l'article 59 de l'arrêté n° 029 du 6 mai 2024 : moyenne des trois trimestres, ou (premier semestre + 2 × second semestre) ÷ 3 dans les établissements évalués par semestre. Le taux de réussite est la part des moyennes annuelles égales ou supérieures à 10/20.`,
    stats.previousYearLabel === stats.yearLabel
      ? "Année close : ses propres bulletins donnent la réussite et la moyenne ; pour une classe, ceux de ses élèves cette année-là."
      : "Pour une classe, les résultats sont ceux obtenus l'an dernier par les élèves qui la composent aujourd'hui.",
    `Chaque niveau additionne exactement les chiffres de ses subdivisions. Calculé le ${formatDateTime(stats.computedAt)}, actualisé à chaque modification.`,
  ];
  return (
    <>
      <span className="block font-semibold">Méthode de calcul</span>
      {items.map((item) => (
        <span key={item} className="mt-1.5 block pl-3 -indent-3">
          · {item}
        </span>
      ))}
    </>
  );
}

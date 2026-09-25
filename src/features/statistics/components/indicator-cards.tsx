import { Accessibility, CalendarX2, GraduationCap, Inbox, Landmark, LayoutGrid, Trophy, UserSquare2 } from "lucide-react";

import { StatCard, StatGrid } from "@/components/kit/stat-card";
import { formatNumber, formatPercent } from "@/lib/utils";

import type { ScopeStatistics } from "../queries";
import { formatIndicator } from "../format";

// Key figures of a scope. Same cards at every level; a school shows its
// classes instead of a count of schools.
export function IndicatorCards({ stats, requestsHref }: { stats: ScopeStatistics; requestsHref?: string }) {
  const t = stats.total;
  const isSchool = stats.scope.level === "SCHOOL";
  const prev = stats.previousYearLabel ?? "année précédente";
  return (
    <StatGrid>
      {isSchool ? (
        <StatCard label="Classes" value={formatNumber(t.classes)} hint={`Effectif moyen ${formatIndicator("averageClassSize", t.averageClassSize)}`} icon={LayoutGrid} />
      ) : (
        <StatCard
          label="Établissements"
          value={formatNumber(t.schools)}
          hint={`${formatNumber(t.activeSchools)} actif${t.activeSchools > 1 ? "s" : ""} · ${formatNumber(t.classes)} classes`}
          icon={Landmark}
        />
      )}
      <StatCard label="Élèves inscrits" value={formatNumber(t.enrollments)} hint={`Filles : ${formatPercent(t.girlsShare, 1)}`} icon={GraduationCap} tone="info" />
      <StatCard label="Enseignants" value={formatNumber(t.teachers)} hint={`${formatIndicator("studentsPerTeacher", t.studentsPerTeacher)} élèves par enseignant`} icon={UserSquare2} tone="accent" />
      <StatCard
        label="Taux de réussite"
        value={formatPercent(t.passRate, 1)}
        hint={`${prev} · moyenne ${formatIndicator("meanAverage", t.meanAverage)}`}
        icon={Trophy}
        tone={t.passRate !== null && t.passRate < 0.5 ? "danger" : "primary"}
      />
      <StatCard
        label="Taux d'absence"
        value={formatPercent(t.absenceRate, 1)}
        hint={`Année ${stats.yearLabel ?? "en cours"}, demi-journées relevées`}
        icon={CalendarX2}
        tone={t.absenceRate !== null && t.absenceRate > 0.1 ? "danger" : "warning"}
      />
      <StatCard label="Élèves en situation de handicap" value={formatNumber(t.disabled)} hint={`${formatPercent(t.disabledShare, 1)} des élèves`} icon={Accessibility} tone="info" />
      {!isSchool && (
        <StatCard label="Effectif moyen par classe" value={formatIndicator("averageClassSize", t.averageClassSize)} hint="Élèves par classe" icon={LayoutGrid} tone="accent" />
      )}
      <StatCard
        label="Demandes en attente"
        value={formatNumber(t.pendingRequests)}
        hint="Adressées au ministère"
        icon={Inbox}
        tone={t.pendingRequests > 0 ? "warning" : "primary"}
        href={requestsHref}
      />
    </StatGrid>
  );
}

import { mention } from "@/lib/domain/grades";
import { formatAverage } from "@/lib/utils";

// Rank of each mention on the five step scale drawn next to the value.
const RANK: Record<string, number> = { "Très bien": 5, Bien: 4, "Assez bien": 3, Passable: 2, Insuffisant: 1 };
const TONE = { excellent: "success", good: "success", average: "warning", risk: "danger" } as const;

// An average as it reads on a report card: the value, a five step gauge and
// the mention in words. The meaning never rests on colour alone: the word
// says it, the number of filled steps says it again (Insuffisant 1 to Très
// bien 5), and in high contrast the steps are drawn in the text colour.
// Screen readers hear "14,50 sur 20, Bien".
export function AverageLevel({ average, size = "md", showValue = true }: { average: number | null; size?: "md" | "lg"; showValue?: boolean }) {
  const m = mention(average);
  if (!m) return <span className="text-muted">Pas encore de note</span>;
  const rank = RANK[m.label] ?? 0;
  return (
    <span className="ds-level" data-tone={TONE[m.level]} data-size={size === "lg" ? "lg" : undefined}>
      {showValue && (
        <span className="ds-level-value">
          {formatAverage(average)}
          <span className="ds-level-unit" aria-hidden>
            /20
          </span>
          <span className="sr-only"> sur 20,</span>
        </span>
      )}
      <span className="ds-level-steps" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} data-on={i <= rank || undefined} />
        ))}
      </span>
      <span className="ds-level-word">{m.label}</span>
    </span>
  );
}

import { AlertTriangle, Minus, Star, ThumbsUp } from "lucide-react";

import { mention } from "@/lib/domain/grades";
import { cn, formatAverage } from "@/lib/utils";

const LEVELS = {
  excellent: { Icon: Star, cls: "border-success/20 bg-success-soft text-success" },
  good: { Icon: ThumbsUp, cls: "border-success/20 bg-success-soft text-success" },
  average: { Icon: Minus, cls: "border-warning/25 bg-warning-soft text-warning" },
  risk: { Icon: AlertTriangle, cls: "border-danger/20 bg-danger-soft text-danger" },
};

// An average shown with an icon, a colour and a word, so the meaning never
// depends on colour or on reading numbers alone.
//
// One layout everywhere: icon, value, then the mention. When the room is
// short (large text, a phone card, a narrow key figure) the mention, then the
// value, move to the next line as a whole, never cut, and the badge stays
// inside its container. The
// radius is half the height of one line: a pill on one line, a rounded
// rectangle on two, never a lozenge.
export function AverageLevel({ average, size = "md", showValue = true }: { average: number | null; size?: "md" | "lg"; showValue?: boolean }) {
  const m = mention(average);
  if (!m) return <span className="text-muted">Pas encore de note</span>;
  const { Icon, cls } = LEVELS[m.level];
  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 border font-semibold",
        cls,
        size === "lg" ? "rounded-[1.4375rem] px-4 py-2 text-lg leading-7" : "rounded-[0.9375rem] px-2.5 py-1 text-sm leading-5",
      )}
    >
      <Icon className={cn("shrink-0", size === "lg" ? "size-5" : "size-4")} aria-hidden />
      {showValue && <span className="whitespace-nowrap tabular-nums">{formatAverage(average)}/20</span>}
      <span className="whitespace-nowrap">{m.label}</span>
    </span>
  );
}

import { AlertTriangle, Minus, Star, ThumbsUp } from "lucide-react";

import { mention } from "@/lib/domain/grades";
import { cn, formatAverage } from "@/lib/utils";

const LEVELS = {
  excellent: { Icon: Star, cls: "bg-success-soft text-success" },
  good: { Icon: ThumbsUp, cls: "bg-success-soft text-success" },
  average: { Icon: Minus, cls: "bg-warning-soft text-warning" },
  risk: { Icon: AlertTriangle, cls: "bg-danger-soft text-danger" },
};

// An average shown with an icon, a colour and a word, so the meaning never
// depends on colour or on reading numbers alone.
export function AverageLevel({ average, size = "md", showValue = true }: { average: number | null; size?: "md" | "lg"; showValue?: boolean }) {
  const m = mention(average);
  if (!m) return <span className="text-muted">Pas encore de note</span>;
  const { Icon, cls } = LEVELS[m.level];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full font-semibold", cls, size === "lg" ? "px-4 py-2 text-lg" : "px-2.5 py-1 text-sm")}>
      <Icon className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
      {showValue && <span>{formatAverage(average)}/20</span>}
      <span>{m.label}</span>
    </span>
  );
}

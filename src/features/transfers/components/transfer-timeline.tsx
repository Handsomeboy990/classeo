import { CheckCircle2, CircleDashed, Clock, XCircle } from "lucide-react";

import { cn, formatDateTime } from "@/lib/utils";

import { STATUS_LABELS, STATUS_TONES, transferTimeline, type TimelineInput, type TransferStatusCode } from "../logic";
import { Badge } from "@/components/ui/badge";

const ICONS = { done: CheckCircle2, current: Clock, refused: XCircle, upcoming: CircleDashed } as const;
const WORDS = { done: "Fait", current: "En cours", refused: "Refusé", upcoming: "À venir" } as const;

// Every step of a transfer: the icon and a word carry the state, never the
// colour alone.
export function TransferTimeline({ input }: { input: TimelineInput }) {
  const steps = transferTimeline(input);
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((s, i) => {
        const Icon = ICONS[s.tone];
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute top-7 bottom-0 left-[0.8rem] w-px bg-border-strong" aria-hidden />}
            <span
              className={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full",
                s.tone === "done" && "bg-success-soft text-success",
                s.tone === "current" && "bg-warning-soft text-warning",
                s.tone === "refused" && "bg-danger-soft text-danger",
                s.tone === "upcoming" && "bg-surface-2 text-muted",
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="font-semibold text-text">
                <span className="sr-only">{WORDS[s.tone]} : </span>
                {s.title}
              </p>
              <p className="text-sm text-muted">
                {s.at ? formatDateTime(s.at) : WORDS[s.tone]}
                {s.detail ? ` · ${s.detail}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TransferStatusBadge({ status }: { status: TransferStatusCode }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

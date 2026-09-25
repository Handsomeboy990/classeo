import { Ban, CheckCircle2, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { SCHOOL_STATUS_LABELS, SCHOOL_STATUS_TONES, type SchoolStatus } from "../labels";

const ICONS = { ACTIVE: CheckCircle2, SUSPENDED: PauseCircle, CLOSED: Ban };

// Status of a school with an icon and a word, never a colour alone.
export function SchoolStatusBadge({ status, reason }: { status: SchoolStatus; reason?: string | null }) {
  const Icon = ICONS[status];
  return (
    <Badge tone={SCHOOL_STATUS_TONES[status]} title={reason ?? undefined}>
      <Icon aria-hidden />
      {SCHOOL_STATUS_LABELS[status]}
    </Badge>
  );
}

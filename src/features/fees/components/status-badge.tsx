import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { INSTALLMENT_STATUS_LABELS, INVOICE_STATUS_LABELS, type InvoiceStatusCode } from "@/lib/domain/payments";

const STYLE = {
  PENDING: { tone: "neutral", Icon: Clock },
  PARTIALLY_PAID: { tone: "info", Icon: CircleDashed },
  PAID: { tone: "success", Icon: CheckCircle2 },
  OVERDUE: { tone: "danger", Icon: AlertTriangle },
  CANCELLED: { tone: "neutral", Icon: Ban },
} as const;

// Status with an icon and a word: the meaning never rests on colour alone.
export function StatusBadge({ status, kind = "invoice" }: { status: InvoiceStatusCode; kind?: "invoice" | "installment" }) {
  const { tone, Icon } = STYLE[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {(kind === "invoice" ? INVOICE_STATUS_LABELS : INSTALLMENT_STATUS_LABELS)[status]}
    </Badge>
  );
}

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-info/20 border-l-info bg-info-soft", icon: "text-info", Icon: Info },
  success: { cls: "border-success/20 border-l-success bg-success-soft", icon: "text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning/25 border-l-warning bg-warning-soft", icon: "text-warning", Icon: AlertTriangle },
  danger: { cls: "border-danger/20 border-l-danger bg-danger-soft", icon: "text-danger", Icon: XCircle },
};

// A message in the flow of the page: the soft tone, a 4 px bar of the tone
// on the left, a hairline around. The icon carries the tone with the
// colour, the text stays in the body colour for reading; the title is in
// Montserrat.
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: ReactNode;
  // A button or a link placed after the message.
  action?: ReactNode;
  className?: string;
}) {
  const { cls, icon, Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-wrap gap-x-3 gap-y-2 rounded-control border border-l-4 px-4 py-3 text-[0.9375rem]", cls, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", icon)} aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed text-text">
        {title && <p className="font-display text-[0.9375rem] font-bold">{title}</p>}
        {children}
      </div>
      {action && <div className="flex w-full items-center gap-2 pl-8 sm:w-auto sm:pl-0">{action}</div>}
    </div>
  );
}

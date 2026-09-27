import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Status pill: 24 px, fully rounded, Montserrat 600 in sentence case. The
// soft background of the tone with its text colour; never a solid yellow
// with white text.
export const badgeVariants = cva(
  // A hairline in the tone keeps the badge readable in high contrast, where
  // the soft backgrounds turn white.
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-xs leading-4 font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 text-muted",
        primary: "border-primary/15 bg-primary-soft text-primary",
        success: "border-success/20 bg-success-soft text-success",
        warning: "border-warning/25 bg-warning-soft text-warning",
        danger: "border-danger/20 bg-danger-soft text-danger",
        info: "border-info/20 bg-info-soft text-info",
        accent: "border-warning/25 bg-accent-soft text-on-accent",
      },
      // A 6 px dot before the text, for statuses read at a glance.
      dot: { true: "before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']", false: "" },
    },
    defaultVariants: { tone: "neutral", dot: false },
  },
);

export function Badge({ className, tone, dot, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, dot }), className)} {...props} />;
}

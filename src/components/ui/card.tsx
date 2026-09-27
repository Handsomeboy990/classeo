import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Card: the surface, a 1 px border, the 8 px radius and only the xs shadow
// at rest. 20 px of padding, 24 px from 64rem (--card-pad, so a page can
// still pass p-0 or px-0). The title is a card heading
// (Montserrat 700, 0.9375rem) whatever its level.
export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-card border border-border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-(--card-pad) py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-[0.9375rem] leading-snug font-bold text-text", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-0.5 text-sm text-muted", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-(--card-pad)", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-border px-(--card-pad) py-3", className)} {...props} />;
}

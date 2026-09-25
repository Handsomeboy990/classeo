import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-border-strong bg-surface px-3 text-text placeholder:text-muted/80 aria-[invalid=true]:border-danger disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-28 py-2.5", className)} {...props} />;
}

// Native select: lightest option, works with every screen reader and on
// low-end phones.
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(field, "h-11 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-text", className)} {...props} />;
}

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Radius, elevation and motion come from the tokens in globals.css. The press
// feedback is a 1 px shift (transform only, never delays the click).
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out enabled:active:translate-y-px aria-disabled:opacity-55 disabled:opacity-55 disabled:shadow-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary shadow-xs hover:bg-primary-hover",
        secondary: "border border-border-strong bg-surface text-text shadow-xs hover:border-field-border hover:bg-surface-2",
        ghost: "text-text hover:bg-surface-2",
        danger: "bg-danger text-on-danger shadow-xs hover:brightness-95",
        accent: "bg-accent text-on-accent shadow-xs hover:brightness-95",
        // Tinted, for a second action that should still read as positive.
        soft: "border border-primary/15 bg-primary-soft text-primary hover:border-primary/40",
        // Quiet destructive action in a list; the confirmation carries the weight.
        "danger-ghost": "text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-11 px-3.5 text-sm sm:h-9 sm:px-3",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-11 sm:size-10",
        "icon-sm": "size-11 sm:size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

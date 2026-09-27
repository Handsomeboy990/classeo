import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Montserrat 600 in sentence case (never capitals), the 6 px control radius,
// flat fills as on the official sites. Radius and motion come from the
// tokens in globals.css. The press feedback is a 1 px shift (transform only,
// never delays the click). The focus ring is the global 3 px one.
// Below 40rem a long label wraps onto a second, balanced line instead of
// widening the page (large text on a phone); from 40rem it stays on one
// line. Heights are minimums so a wrapped label grows the button.
export const buttonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 rounded-control text-center font-display font-semibold text-balance whitespace-normal sm:whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out enabled:active:translate-y-px aria-disabled:opacity-55 disabled:opacity-55 disabled:shadow-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The main action, one per area.
        primary: "bg-primary text-on-primary hover:bg-primary-hover",
        secondary: "border border-primary/40 bg-surface text-primary hover:border-primary hover:bg-primary-soft",
        ghost: "text-text hover:bg-surface-2",
        danger: "bg-danger text-on-danger hover:brightness-95",
        // The flag yellow with navy text: only on a navy surface, or for
        // "Se connecter" in the public header.
        accent: "bg-accent text-on-accent hover:brightness-95",
        // Tinted, for filters and gentle actions.
        soft: "border border-primary/15 bg-primary-soft text-primary hover:border-primary/40",
        // Quiet destructive action in a list; the confirmation carries the weight.
        "danger-ghost": "text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "min-h-11 px-3.5 py-1.5 text-sm sm:min-h-9 sm:px-3 sm:py-1",
        md: "min-h-11 px-4 py-2 text-sm",
        lg: "min-h-12 px-6 py-2.5 text-base",
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

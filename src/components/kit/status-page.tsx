"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The pages that say something went another way: page not found, access
// refused, an error, no network (design source of truth, 4.13). The status
// code in navy Montserrat over a short tricolour rule (a pictogram when
// there is no code), a plain title, one or two sentences, and clear ways
// back: the main action first. The frame around it (public header and
// footer, or the shell of the private space) belongs to the page.
export function StatusPage({
  code,
  icon,
  tone = "neutral",
  title,
  children,
  actions,
  footer,
  headingLevel = 1,
}: {
  // "404", "403": drawn large, hidden from screen readers (the title says it).
  code?: string;
  // Shown only when there is no code.
  icon?: ReactNode;
  tone?: "neutral" | "warning" | "danger";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-12 text-center sm:py-20">
      <div className="flex flex-col items-center" aria-hidden>
        {code ? (
          <span className="font-display text-[3rem] leading-none font-extrabold tracking-[-0.01em] text-primary tabular-nums sm:text-[4.5rem]">{code}</span>
        ) : icon ? (
          <span
            className={cn(
              "flex size-16 items-center justify-center rounded-full [&_svg]:size-7",
              {
                neutral: "bg-primary-soft text-primary",
                warning: "bg-warning-soft text-warning",
                danger: "bg-danger-soft text-danger",
              }[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="mt-5 flex h-1 w-16">
          <span className="flex-1 bg-flag-green" />
          <span className="flex-1 bg-flag-yellow" />
          <span className="flex-1 bg-flag-red" />
        </span>
      </div>
      <Heading className="mt-6 text-[1.5rem] leading-tight font-bold text-balance text-text lg:text-[1.75rem]">{title}</Heading>
      {children && <div className="mt-3 max-w-md text-pretty text-muted sm:text-lg">{children}</div>}
      {actions && <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 min-[420px]:w-auto min-[420px]:flex-row min-[420px]:items-center">{actions}</div>}
      {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
    </div>
  );
}

// "Page précédente": the browser history when there is one, else a link.
// A secondary button by default; variant "link" for a quiet line under the
// actions.
export function BackButton({ fallback, variant = "button", className }: { fallback: string; variant?: "button" | "link"; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className={cn(
        variant === "button"
          ? buttonVariants({ variant: "secondary", size: "lg" })
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-2 text-sm font-semibold text-link underline-offset-[3px] hover:underline",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden /> Page précédente
    </button>
  );
}

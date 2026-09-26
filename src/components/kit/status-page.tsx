"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

// The pages that say something went another way: page not found, access
// refused, an error, no network. One layout for all of them: a large quiet
// code (404, 403) or pictogram over the flag stripe, a plain title, one or
// two sentences, and clear ways back. "standalone" draws its own header with
// the logo, for the pages rendered outside the app shell.
export function StatusPage({
  code,
  icon,
  tone = "neutral",
  title,
  children,
  actions,
  footer,
  standalone = false,
  headingLevel = 1,
}: {
  // "404", "403": drawn large, hidden from screen readers (the title says it).
  code?: string;
  icon?: ReactNode;
  tone?: "neutral" | "warning" | "danger";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  standalone?: boolean;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const body = (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-5 py-12 text-center sm:py-20">
      <div className="relative flex flex-col items-center" aria-hidden>
        {code ? (
          <span className="ds-status-code font-display text-[5.5rem] leading-none font-extrabold tracking-tight sm:text-[7.5rem]">{code}</span>
        ) : null}
        {icon ? (
          <span
            className={cn(
              "flex size-16 items-center justify-center rounded-2xl ring-1 ring-inset [&_svg]:size-8",
              code && "-mt-7 shadow-raised sm:-mt-9",
              {
                neutral: "bg-surface text-primary ring-border",
                warning: "bg-warning-soft text-warning ring-warning/25",
                danger: "bg-danger-soft text-danger ring-danger/20",
              }[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="ds-flag-stripe mt-6 h-1 w-16 rounded-full" />
      </div>
      <Heading className="mt-6 text-2xl leading-tight font-bold text-balance sm:text-3xl">{title}</Heading>
      {children && <div className="mt-3 max-w-md text-pretty text-muted sm:text-lg">{children}</div>}
      {actions && <div className="mt-8 flex w-full flex-col-reverse items-stretch justify-center gap-2.5 min-[420px]:w-auto min-[420px]:flex-row">{actions}</div>}
      {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
    </div>
  );
  if (!standalone) return body;
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-8">
          <Link href="/" aria-label="Classéo, accueil" className="rounded-lg">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="page-content" tabIndex={-1} className="flex flex-1 items-center outline-none">
        {body}
      </main>
    </div>
  );
}

// "Page précédente": the browser history when there is one, else a link.
export function BackButton({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-text shadow-xs hover:border-field-border hover:bg-surface-2",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden /> Page précédente
    </button>
  );
}

"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import Link from "next/link";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HeaderPopover } from "./header-popover";

// Short code shown on the button: FR, FON, YO.
export function languageCode(code: string) {
  return code.toUpperCase();
}

// Language control of the top bars, the same on the public pages and in the
// private space: a compact button (the translate icon and the current
// language code) opening a small panel with the choices. Language names are
// written in their own language and never translated (data-no-translate).
// tone "inverse" is for the button drawn over a photograph, "header" for the
// navy bars.
export function LanguageMenu({
  code,
  current,
  title = "Langue",
  tone = "default",
  width = 260,
  className,
  children,
}: {
  code: string;
  // Name of the current language, for the accessible name of the button.
  current: string;
  title?: string;
  tone?: "default" | "inverse" | "header";
  width?: number;
  className?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  return (
    <HeaderPopover
      label={title}
      width={width}
      className={cn("shrink-0", className)}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          data-language-menu
          data-no-translate
          aria-label={`${title} : ${current}`}
          title={`${title} : ${current}`}
          className={cn(
            "group inline-flex h-10 items-center gap-1.5 rounded-full border px-2.5 text-sm font-bold tracking-wide transition-colors max-lg:h-11 max-sm:px-2.5",
            tone === "inverse"
              ? "border-white/40 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40"
              : tone === "header"
                ? // The phone bar also holds the brand: below 360 px the button keeps only its icon.
                  "border-white/30 bg-white/10 text-header-text hover:border-white/50 hover:bg-white/15 max-[359px]:w-11 max-[359px]:justify-center max-[359px]:px-0"
                : "border-border-strong bg-surface text-text hover:border-primary hover:bg-surface-2",
          )}
        >
          <Languages className={cn("size-[1.125rem] shrink-0", tone === "default" ? "text-primary" : "text-white")} aria-hidden />
          <span aria-hidden className={cn(tone === "header" && "max-[359px]:hidden")}>
            {code}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70 transition-transform group-aria-expanded:rotate-180 max-sm:hidden" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div data-no-translate className="flex flex-col p-1.5">
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </HeaderPopover>
  );
}

// A titled group of choices inside the panel.
export function LanguageGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-0.5 py-1 not-first:border-t not-first:border-border">
      <p id={id} className="px-2.5 pt-1.5 pb-1 text-xs font-semibold text-muted">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

const OPTION = "flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm font-medium hover:bg-surface-2 lg:min-h-10";

function OptionBody({ label, code, selected }: { label: string; code: string; selected: boolean }) {
  return (
    <>
      <span className="w-9 shrink-0 text-xs font-bold tracking-wide text-muted" aria-hidden>
        {languageCode(code)}
      </span>
      <span className="min-w-0 flex-1" lang={code}>
        {label}
      </span>
      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
    </>
  );
}

// A choice that navigates (public pages: the language lives in the address).
export function LanguageLinkOption({ label, code, selected, ...props }: ComponentProps<typeof Link> & { label: string; code: string; selected: boolean }) {
  return (
    <li>
      <Link {...props} aria-current={selected ? "true" : undefined} className={cn(OPTION, selected && "font-semibold text-primary")}>
        <OptionBody label={label} code={code} selected={selected} />
      </Link>
    </li>
  );
}

// A choice that applies at once (private space).
export function LanguageButtonOption({ label, code, selected, onSelect }: { label: string; code: string; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button type="button" onClick={onSelect} aria-pressed={selected} className={cn(OPTION, selected && "font-semibold text-primary")}>
        <OptionBody label={label} code={code} selected={selected} />
      </button>
    </li>
  );
}

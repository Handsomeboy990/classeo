"use client";

import { BadgeCheck, House, LogIn, Menu, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const ICONS = { home: House, verify: BadgeCheck } satisfies Record<string, LucideIcon>;

const noop = () => () => {};

export type PublicNavItem = {
  key: keyof typeof ICONS;
  href: string;
  label: ReactNode;
  current: boolean;
};

// The menu of the public header below 1024 px: a drawer from the right,
// built on the modal <dialog> like the sheets of the private space. The
// browser traps the focus and closes it on Escape; a click on the veil or
// the close button closes it too, and the focus goes back to the menu
// button. It slides in over 200 ms, and simply appears with reduced motion.
// Rendered into <body>, out of the navy bar: the yellow focus ring of the
// navy surfaces must not reach its light panel.
export function PublicMenu({
  items,
  signIn,
  labels,
  lockup,
  notice,
  lang,
}: {
  items: PublicNavItem[];
  signIn: { href: string; label: ReactNode } | null;
  labels: { menu: string; open: string; close: string; nav: string };
  // Rendered on the server: the brand lockup and the independence notice.
  lockup: ReactNode;
  notice: ReactNode;
  lang: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const titleId = useId();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={labels.open}
        // In px, as the whole phone bar: 44 px at every text size.
        className="inline-flex size-[44px] shrink-0 items-center justify-center rounded-control bg-white/10 text-header-text hover:bg-white/20 lg:hidden"
      >
        <Menu className="size-[22px]" aria-hidden />
      </button>
      {mounted &&
        createPortal(
          <dialog
            ref={dialog}
            id={id}
            lang={lang}
            aria-labelledby={titleId}
            onClose={() => {
              setOpen(false);
              button.current?.focus();
            }}
            // The dialog box itself is only reached through the veil: the panel
            // fills it.
            onClick={(e) => e.target === dialog.current && setOpen(false)}
            // The browser lets Tab leave a modal dialog for its own controls:
            // the focus wraps from the last control to the first and back.
            onKeyDown={(e) => {
              if (e.key !== "Tab" || !dialog.current) return;
              const items = [...dialog.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
              const first = items[0];
              const last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
            className={cn(
              "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(22rem,88vw)] max-w-none overflow-hidden bg-surface p-0 text-text shadow-overlay backdrop:bg-(--overlay)",
              "translate-x-0 transition-transform duration-200 ease-(--ease-emphasis) starting:open:translate-x-full motion-reduce:transition-none",
            )}
          >
            <div className="flex h-full flex-col">
              <div className="shrink-0">
                <div className="flex h-18 items-center gap-3 bg-header pr-3 pl-5">
                  <div className="min-w-0 flex-1">{lockup}</div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={labels.close}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-white/10 text-header-text hover:bg-white/20"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
                <div className="flex h-1" aria-hidden>
                  <span className="flex-1 bg-flag-green" />
                  <span className="flex-1 bg-flag-yellow" />
                  <span className="flex-1 bg-flag-red" />
                </div>
              </div>
              <h2 id={titleId} className="sr-only">
                {labels.menu}
              </h2>
              <nav aria-label={labels.nav} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <ul>
                  {items.map((item) => {
                    const Icon = ICONS[item.key];
                    return (
                      <li key={item.key} className="border-b border-border">
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={item.current ? "page" : undefined}
                          className={cn(
                            "relative flex min-h-12 items-center gap-3 px-5 py-2 font-display text-[0.9375rem] font-semibold text-text hover:bg-surface-2",
                            item.current && "bg-primary-soft text-primary before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
                          )}
                        >
                          <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="flex shrink-0 flex-col gap-4 border-t border-border px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {signIn && (
                  <Link
                    href={signIn.href}
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 font-display text-base font-semibold text-on-primary hover:bg-primary-hover"
                  >
                    <LogIn className="size-[1.125rem]" aria-hidden />
                    {signIn.label}
                  </Link>
                )}
                {notice}
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

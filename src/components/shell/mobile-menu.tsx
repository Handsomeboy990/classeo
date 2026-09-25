"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Navigation drawer for small screens. Keyboard contract: focus moves into
// the drawer on open, Tab stays inside it, Escape closes it and focus returns
// to the button that opened it.
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  // Close the drawer when navigation happens (state derived during render,
  // the pattern React recommends over an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    closeBtn.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])");
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div ref={panel} className="relative flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-sidebar p-4">
            <button
              ref={closeBtn}
              type="button"
              onClick={() => setOpen(false)}
              className="mb-4 ml-auto inline-flex size-10 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover"
              aria-label="Fermer le menu"
            >
              <X className="size-5" aria-hidden />
            </button>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the drawer when navigation happens (state derived during render,
  // the pattern React recommends over an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-sidebar p-4">
            <button
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

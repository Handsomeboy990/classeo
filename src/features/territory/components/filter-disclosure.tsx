"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// On a phone, a long filter form folds behind one "Filtres" button so the
// list starts on the first screen. From 40rem, and before JavaScript has
// loaded, the fields stay visible.
export function FilterDisclosure({ active, children }: { active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const shown = !hydrated || open;
  return (
    <>
      {hydrated && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="col-span-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-text sm:hidden"
        >
          <SlidersHorizontal className="size-4 text-muted" aria-hidden />
          Filtres
          {active > 0 && <span className="rounded-full bg-primary px-2 text-xs leading-5 text-on-primary tabular-nums">{active}</span>}
          <ChevronDown className={cn("ml-auto size-5 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
      <div id={id} className={cn("col-span-2 grid grid-cols-subgrid gap-3 sm:contents", !shown && "max-sm:hidden")}>
        {children}
      </div>
    </>
  );
}

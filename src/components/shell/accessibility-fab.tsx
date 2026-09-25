"use client";

import { Accessibility } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { AccessibilityPanel } from "./accessibility-panel";

// Floating accessibility button, bottom right as in mobile apps: 40 px on a
// phone, 44 px from lg, surface coloured, out of the way of the content. It steps aside while the
// page scrolls down (reading) and comes back as soon as it scrolls up or
// reaches the end, where the shell reserves room for it. Keyboard focus
// always shows it. The public home page keeps its button in the header, and
// so does the private space on a large screen; a page with a save bar at the
// bottom hides it on phones (see .a11y-fab in globals.css).
export function AccessibilityFab() {
  const [open, setOpen] = useState(false);
  const [away, setAway] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const end = y + window.innerHeight >= document.documentElement.scrollHeight - 8;
      if (end || y < 64) setAway(false);
      else if (y > last + 6) setAway(true);
      else if (y < last - 6) setAway(false);
      last = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname === "/") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "a11y-fab inline-flex size-(--fab-size) items-center justify-center rounded-full border border-border bg-surface text-muted shadow-md shadow-black/10 transition-[translate,opacity,scale] duration-200 ease-out hover:text-text focus-visible:translate-y-0 focus-visible:opacity-100 active:scale-95",
          away && "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-label="Réglages d'accessibilité"
        aria-haspopup="dialog"
        title="Accessibilité"
      >
        <Accessibility className="size-[20px]" aria-hidden />
      </button>
      <AccessibilityPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

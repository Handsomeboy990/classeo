"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { badgeText, unreadLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// Fired by the notification watcher when something new arrives.
export const NEW_NOTIFICATION_EVENT = "classeo:new-notification";

// The bell of the top bar. A new notification makes it ring once (a short
// swing, transform only, 700 ms, none under reduced motion) and the count
// pops in; the count is part of the accessible name.
// tone "dark": white on the navy bars, the count in flag yellow (shell.css).
export function BellLink({ unread, tone = "light", className }: { unread: number; tone?: "light" | "dark"; className?: string }) {
  const pathname = usePathname();
  const [ring, setRing] = useState(0);
  useEffect(() => {
    const onNew = () => setRing((n) => n + 1);
    window.addEventListener(NEW_NOTIFICATION_EVENT, onNew);
    return () => window.removeEventListener(NEW_NOTIFICATION_EVENT, onNew);
  }, []);

  return (
    <Link
      href="/espace/notifications"
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        tone === "dark" ? "text-header-text hover:bg-white/10 active:bg-white/15" : "text-text hover:bg-surface-2 active:bg-surface-2",
        className,
      )}
      aria-label={unread ? `Notifications, ${unreadLabel(unread)}` : "Notifications"}
      aria-current={pathname === "/espace/notifications" ? "page" : undefined}
    >
      <Bell key={ring} className={cn("size-[1.375rem] lg:size-5", ring > 0 && "bell-ring")} aria-hidden />
      {unread > 0 && (
        <span key={`c${ring}`} className={cn("nav-badge absolute top-1 right-0.5", ring > 0 && "badge-pop")} aria-hidden>
          {badgeText(unread)}
        </span>
      )}
    </Link>
  );
}

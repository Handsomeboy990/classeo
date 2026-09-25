"use client";

import { Bell, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";

import { AccountSheet, type ShellUser } from "./account-sheet";
import type { RenderedSection } from "./sidebar-nav";

// Client side navigations since the app was opened: the back button uses
// the history only when there is an earlier page of ours to go back to.
let inAppNavigations = 0;
let lastPath: string | null = null;

// The menu entry a page belongs to: the longest href that prefixes it.
function owner(sections: RenderedSection[], pathname: string) {
  let best: { href: string; label: string } | null = null;
  for (const item of sections.flatMap((s) => s.items)) {
    const inside = item.href === "/espace" ? pathname === "/espace" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (inside && (!best || item.href.length > best.href.length)) best = { href: item.href, label: item.short ?? item.label };
  }
  return best;
}

// Follows the page's own h1: once it has scrolled under the bar, the bar
// shows it, as the large titles of iOS do.
function useScrolledHeading(pathname: string) {
  const [heading, setHeading] = useState<{ path: string; text: string } | null>(null);
  useEffect(() => {
    let io: IntersectionObserver | null = null;
    let target: Element | null = null;
    const watch = () => {
      const h1 = document.querySelector("#page-content h1");
      if (!h1 || h1 === target) return;
      io?.disconnect();
      target = h1;
      io = new IntersectionObserver(
        ([entry]) => setHeading(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0 ? { path: pathname, text: h1.textContent?.trim() ?? "" } : null),
        { rootMargin: "-56px 0px 0px 0px" },
      );
      io.observe(h1);
    };
    watch();
    // Pages stream in: the heading may arrive after the shell.
    const main = document.getElementById("page-content");
    const mo = main ? new MutationObserver(watch) : null;
    if (main) mo?.observe(main, { childList: true, subtree: true });
    return () => {
      io?.disconnect();
      mo?.disconnect();
    };
  }, [pathname]);
  return heading?.path === pathname && heading.text ? heading.text : null;
}

// Top app bar of the phone shell: one line, never wrapping. Home shows the
// brand; a page below a menu entry gets a back button and the entry's name.
export function AppBar({ sections, unread, user, pushKey }: { sections: RenderedSection[]; unread: number; user: ShellUser; pushKey: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState(false);
  const scrolled = useScrolledHeading(pathname);

  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) inAppNavigations++;
    lastPath = pathname;
    if ("setAppBadge" in navigator) {
      // Installed app: the unread count on the home screen icon.
      const nav = navigator as Navigator & { setAppBadge: (n?: number) => Promise<void>; clearAppBadge: () => Promise<void> };
      (unread ? nav.setAppBadge(unread) : nav.clearAppBadge()).catch(() => undefined);
    }
  }, [pathname, unread]);

  const home = pathname === "/espace";
  const entry = owner(sections, pathname);
  const detail = !home && (!entry || entry.href !== pathname);
  // A menu page carries its own large title: the bar shows it only once that
  // heading has scrolled away. A page below an entry names its entry.
  const title = home ? "Classéo" : (scrolled ?? (detail && entry ? entry.label : "Classéo"));
  const backTo = entry && entry.href !== pathname ? entry.href : "/espace";

  return (
    <div data-app-bar className="flex h-(--app-bar-h) items-center gap-1 px-1.5 lg:hidden">
      {detail ? (
        <button
          type="button"
          onClick={() => (inAppNavigations > 0 ? router.back() : router.push(backTo))}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text active:bg-surface-2"
          aria-label="Retour"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
      ) : (
        <Link href="/espace" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full" aria-label="Classéo, accueil">
          <LogoMark className="size-8" />
        </Link>
      )}
      <p key={title} className="app-title-in min-w-0 flex-1 truncate px-1 font-display text-lg font-bold">
        {title}
      </p>
      <Link
        href="/espace/notifications"
        className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text active:bg-surface-2"
        aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
        aria-current={pathname === "/espace/notifications" ? "page" : undefined}
      >
        <Bell className="size-[1.35rem]" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-0.5 min-w-5 rounded-full border-2 border-surface bg-danger px-1 text-center text-[0.6875rem] leading-4 font-bold text-bg" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={() => setAccount(true)}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full active:bg-surface-2"
        aria-label="Mon compte"
        aria-haspopup="dialog"
        aria-expanded={account}
      >
        <Avatar name={user.fullName} className="size-8 text-xs" />
      </button>
      <AccountSheet open={account} onClose={() => setAccount(false)} user={user} pushKey={pushKey} />
    </div>
  );
}

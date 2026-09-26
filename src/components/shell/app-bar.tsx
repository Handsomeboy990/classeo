"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { frenchTextContent } from "@/features/languages/client";

import { AccountSheet, type ShellUser } from "./account-sheet";
import { BellLink } from "./bell-link";
import { ScopeIdentity, type ShellScope } from "./scope-identity";
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
        ([entry]) => setHeading(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0 ? { path: pathname, text: frenchTextContent(h1).trim() } : null),
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

// Top app bar of the phone shell: one line, never wrapping. Home and the
// menu pages speak for the user's territory or school (flag or logo and its
// name, with the school switcher); a page below a menu entry gets a back
// button and the entry's name.
export function AppBar({ sections, unread, user, pushKey, scope }: { sections: RenderedSection[]; unread: number; user: ShellUser; pushKey: string | null; scope: ShellScope }) {
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
  // A menu page carries its own large title: the bar shows the identity
  // until that heading has scrolled away, then the heading. A page below an
  // entry names its entry.
  const title = scrolled ?? (detail ? (entry?.label ?? "Classéo") : null);
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
      ) : null}
      {title ? (
        <p key={title} className="app-title-in min-w-0 flex-1 truncate px-1 font-display text-lg font-bold">
          {title}
        </p>
      ) : (
        <div className="flex min-w-0 flex-1 items-center pl-2.5">
          <ScopeIdentity scope={scope} compact />
        </div>
      )}
      <BellLink unread={unread} />
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

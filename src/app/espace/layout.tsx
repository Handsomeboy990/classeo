import { Bell, LogOut, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { AccessibilityButton } from "@/components/shell/accessibility-button";
import { AppBar } from "@/components/shell/app-bar";
import { SidebarNav, type RenderedItem, type RenderedSection } from "@/components/shell/sidebar-nav";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { TabBar } from "@/components/shell/tab-bar";
import { Avatar } from "@/components/ui/avatar";
import { InstallCard } from "@/features/pwa/install-ui";
import { requireUser } from "@/lib/auth/session";
import { pushPublicKey } from "@/lib/channels/push";
import { db } from "@/lib/db";
import { mobileTabs, tabAudience, visibleNavigation, type NavItem } from "@/lib/navigation";
import { roleLabel } from "@/features/messages/role-label";

function render(item: NavItem): RenderedItem {
  return { label: item.label, short: item.short, href: item.href, icon: <item.icon aria-hidden /> };
}

export default async function SpaceLayout({ children }: LayoutProps<"/espace">) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/changer-mot-de-passe");

  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const visible = visibleNavigation(user);
  const sections: RenderedSection[] = visible.map((s) => ({ title: s.title, items: s.items.map(render) }));
  const tabs = mobileTabs(visible, tabAudience(user)).map(render);
  const shellUser = { fullName: user.fullName, email: user.email ?? user.username, roleName: roleLabel(user.role.name, user.gender), scopeLabel: user.scope.label };
  const pushKey = pushPublicKey();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-sidebar px-3 py-5 lg:flex">
        <Link href="/espace" className="mb-6 px-3">
          <Logo tone="inverse" />
        </Link>
        <SidebarNav sections={sections} />
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Overlays never live in here: the blur makes this header the
            containing block of any fixed descendant. Sheets are portalled. */}
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <AppBar sections={sections} unread={unread} user={shellUser} pushKey={pushKey} />

          <div className="hidden min-h-16 items-center gap-3 px-6 py-2 lg:flex">
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4" aria-hidden />
              <span className="sr-only">Périmètre :</span>
              {user.scope.label}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {/* Docked here on a large screen instead of floating over tables
                  and values (see .a11y-fab in globals.css). */}
              <span data-a11y-docked className="contents">
                <AccessibilityButton />
              </span>
              <Link
                href="/espace/notifications"
                className="relative inline-flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface hover:bg-surface-2"
                aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
              >
                <Bell className="size-5" aria-hidden />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-bg" aria-hidden>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2 border-l border-border pl-3">
                <Avatar name={user.fullName} />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user.fullName}</p>
                  <p className="text-xs text-muted">{roleLabel(user.role.name, user.gender)}</p>
                </div>
                <SignOutButton
                  label="Se déconnecter"
                  className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
                >
                  <LogOut className="size-5" aria-hidden />
                </SignOutButton>
              </div>
            </div>
          </div>
        </header>

        <InstallCard />
        <main id="page-content" tabIndex={-1} className="app-main mx-auto w-full max-w-7xl flex-1 px-4 pt-5 outline-none sm:px-6 lg:pt-8">
          {children}
        </main>
      </div>

      <TabBar tabs={tabs} sections={sections} />
    </div>
  );
}

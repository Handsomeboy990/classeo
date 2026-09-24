import { Bell, LogOut, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { AccessibilityButton } from "@/components/shell/accessibility-button";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { SidebarNav, type RenderedSection } from "@/components/shell/sidebar-nav";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { visibleNavigation } from "@/lib/navigation";

export default async function SpaceLayout({ children }: LayoutProps<"/espace">) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/changer-mot-de-passe");

  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const sections: RenderedSection[] = visibleNavigation(user).map((s) => ({
    title: s.title,
    items: s.items.map((i) => ({ label: i.label, href: i.href, icon: <i.icon aria-hidden /> })),
  }));

  const nav = <SidebarNav sections={sections} />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-sidebar px-3 py-5 lg:flex">
        <Link href="/espace" className="mb-6 px-3">
          <Logo tone="inverse" />
        </Link>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <MobileMenu>{nav}</MobileMenu>
          <Link href="/espace" className="lg:hidden" aria-label="Classéo, accueil">
            <Logo className="[&>span:last-child]:max-[380px]:hidden" />
          </Link>
          <p className="hidden items-center gap-1.5 text-sm text-muted md:flex">
            <MapPin className="size-4" aria-hidden />
            <span className="sr-only">Périmètre :</span>
            {user.scope.label}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <AccessibilityButton />
            <Link
              href="/espace/notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface hover:bg-surface-2"
              aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
            >
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs leading-5 font-bold text-white" aria-hidden>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <Avatar name={user.fullName} />
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold">{user.fullName}</p>
                <p className="text-xs text-muted">{user.role.name}</p>
              </div>
              <form action={logout}>
                <button type="submit" className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label="Se déconnecter" title="Se déconnecter">
                  <LogOut className="size-5" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main id="page-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

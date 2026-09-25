import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { AppBar } from "@/components/shell/app-bar";
import { NewsTicker } from "@/components/shell/news-ticker";
import type { ShellScope } from "@/components/shell/scope-identity";
import { SidebarNav, type RenderedItem, type RenderedSection } from "@/components/shell/sidebar-nav";
import { TabBar } from "@/components/shell/tab-bar";
import { TopBar } from "@/components/shell/top-bar";
import { tickerContents } from "@/features/contents/queries";
import { roleLabel } from "@/features/messages/role-label";
import { NotificationWatcher } from "@/features/notifications/notification-watcher";
import { OfflineSession } from "@/features/offline/offline-session";
import { offlinePages } from "@/features/offline/pages";
import { LanguageBar } from "@/features/languages/language-bar";
import { InstallCard } from "@/features/pwa/install-ui";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { pushPublicKey } from "@/lib/channels/push";
import { db } from "@/lib/db";
import { isEnabled } from "@/lib/features";
import { fileUrl } from "@/lib/files";
import { mobileTabs, navigationBadges, tabAudience, visibleNavigation, type NavItem } from "@/lib/navigation";
import { SchoolStatusBanner } from "@/features/school-status/components/status-banner";

const CAPTIONS = { NATIONAL: "République du Bénin", DEPARTMENT: "Département", COMMUNE: "Commune", SCHOOL: "Établissement", SELF: "Espace famille" } as const;

// What the top bar speaks for: the flag and the territory for national,
// departmental and communal staff and for families, the logo and the school
// for school staff.
function shellScope(user: NonNullable<CurrentUser>): ShellScope {
  const level = user.scope.level;
  const school = level === "SCHOOL";
  return {
    kind: school ? "school" : level === "SELF" ? "family" : "territory",
    name: level === "NATIONAL" ? "Bénin" : level === "SELF" ? "Espace famille" : user.scope.label,
    caption: level === "SELF" ? user.scope.label : CAPTIONS[level],
    logoUrl: school ? fileUrl(user.scope.logoFileId) : null,
    schools: school ? user.schools : [],
    activeSchoolId: school ? user.scope.schoolId : null,
  };
}

export default async function SpaceLayout({ children }: LayoutProps<"/espace">) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/changer-mot-de-passe");

  const [unreadRows, ticker, pages] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id, readAt: null }, select: { link: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    isEnabled("contents.ticker").then((on) => (on ? tickerContents(user).catch(() => []) : [])),
    offlinePages(user),
  ]);
  const unread = unreadRows.length;
  const visible = visibleNavigation(user);
  const badges = navigationBadges(
    visible,
    unreadRows.map((n) => n.link),
  );
  const render = (item: NavItem): RenderedItem => ({ label: item.label, short: item.short, href: item.href, icon: <item.icon aria-hidden />, badge: badges[item.href] });
  const sections: RenderedSection[] = visible.map((s) => ({ title: s.title, items: s.items.map(render) }));
  const tabs = mobileTabs(visible, tabAudience(user)).map(render);
  const shellUser = {
    fullName: user.fullName,
    email: user.email ?? user.username,
    roleName: roleLabel(user.role.name, user.gender),
    scopeLabel: user.scope.label,
    canSwitchSchool: user.schools.length > 1,
  };
  const scope = shellScope(user);
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
            containing block of any fixed descendant. Popovers and sheets
            open in the top layer. */}
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <AppBar sections={sections} unread={unread} user={shellUser} pushKey={pushKey} scope={scope} />
          <TopBar scope={scope} unread={unread} user={shellUser} pushKey={pushKey} />
          <NewsTicker items={ticker} />
          <OfflineSession userId={user.id} pages={pages} />
        </header>

        <InstallCard />
        <LanguageBar />
        <main id="page-content" tabIndex={-1} className="app-main mx-auto w-full max-w-7xl flex-1 px-4 pt-5 outline-none sm:px-6 lg:pt-8">
          <SchoolStatusBanner user={user} />
          {children}
        </main>
      </div>

      <TabBar tabs={tabs} sections={sections} />
      <NotificationWatcher latestAt={unreadRows[0]?.createdAt.getTime() ?? null} />
    </div>
  );
}

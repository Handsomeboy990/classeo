import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FlagStripe } from "@/components/brand/flag";
import { loadBrand } from "@/components/brand/load-brand";
import { BrandLockup } from "@/components/brand/lockup";
import { AppFooter } from "@/components/shell/app-footer";
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
import { LanguageBar, translationAccess } from "@/features/languages/language-bar";
import { InstallCard } from "@/features/pwa/install-ui";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { pushPublicKey } from "@/lib/channels/push";
import { db } from "@/lib/db";
import { isEnabled } from "@/lib/features";
import { fileUrl } from "@/lib/files";
import { mobileTabs, navigationBadges, tabAudience, visibleNavigation, type NavItem } from "@/lib/navigation";
import { SchoolStatusBanner } from "@/features/school-status/components/status-banner";
import { NO_INDEX } from "@/lib/seo";

import "@/components/shell/shell.css";

// The private space is never indexed (robots.txt and the X-Robots-Tag header
// of next.config.ts say so too).
export const metadata: Metadata = { robots: NO_INDEX };

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

  const [unreadRows, ticker, pages, translation, brand] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id, readAt: null }, select: { link: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    isEnabled("contents.ticker").then((on) => (on ? tickerContents(user).catch(() => []) : [])),
    offlinePages(user),
    translationAccess(user),
    loadBrand(),
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
    <div data-shell className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr] lg:pt-1">
      {/* The tricolour rule over the whole window, above the side menu and
          the top bar (design source of truth, part 3.4). */}
      <div data-top-rule className="fixed inset-x-0 top-0 z-50 hidden lg:block">
        <FlagStripe className="h-1" />
      </div>
      <aside className="sticky top-1 hidden h-[calc(100dvh-4px)] flex-col bg-sidebar lg:flex">
        {/* Brand zone: the navy band of the top bar, continued. */}
        <div className="flex h-16 shrink-0 items-center border-b border-white/10 bg-header px-5">
          <BrandLockup brand={brand} tone="dark" size="sidebar" href="/espace" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-5 pb-6">
          <SidebarNav sections={sections} />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col lg:min-h-[calc(100dvh-4px)]">
        {/* Overlays never live in here: popovers and sheets open in the top
            layer. The navy reaches under the status bar of the phone. */}
        <header className="sticky top-0 z-40 bg-header pt-[env(safe-area-inset-top)] lg:top-1 lg:pt-0">
          <AppBar sections={sections} unread={unread} user={shellUser} pushKey={pushKey} brand={brand} languages={translation?.languages ?? null} />
          <TopBar scope={scope} unread={unread} user={shellUser} pushKey={pushKey} languages={translation?.languages ?? null} />
          <NewsTicker items={ticker} />
          <OfflineSession userId={user.id} pages={pages} />
        </header>

        <InstallCard />
        {translation && <LanguageBar user={user} access={translation} />}
        <main id="page-content" tabIndex={-1} className="app-main mx-auto w-full max-w-7xl flex-1 px-4 pt-5 outline-none sm:px-6 lg:pt-8">
          <SchoolStatusBanner user={user} />
          {children}
        </main>
        <AppFooter brand={brand} year={new Date().getFullYear()} />
      </div>

      <TabBar tabs={tabs} sections={sections} brand={brand} />
      <NotificationWatcher latestAt={unreadRows[0]?.createdAt.getTime() ?? null} />
    </div>
  );
}

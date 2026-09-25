import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Home,
  Inbox,
  KeyRound,
  Landmark,
  LifeBuoy,
  LayoutGrid,
  type LucideIcon,
  Map,
  Megaphone,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  UserSquare2,
  Wallet,
  Baby,
} from "lucide-react";

import type { PermissionCode } from "@/lib/auth/permissions";

// The kind of user the phone tab bar is tuned for. Derived from the scope,
// never from a role name: rights stay the single source of what is shown.
export type TabAudience = "family" | "teacher" | "school" | "territory";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // Any of these permissions shows the entry. Omitted: every signed in user.
  permission?: PermissionCode[];
  // Restrict to scope levels (e.g. family entries only for SELF users).
  scopes?: ("NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF")[];
  // Label for narrow places: the phone tab bar and the top app bar.
  short?: string;
  // Rank in the phone tab bar per audience, 1 first. The three best ranked
  // entries the user can see become tabs, next to the dashboard.
  tab?: Partial<Record<TabAudience, number>>;
};

export type NavSection = { title: string; items: NavItem[] };

const STAFF = ["NATIONAL", "DEPARTMENT", "COMMUNE", "SCHOOL"] as NavItem["scopes"];
const TERRITORY = ["NATIONAL", "DEPARTMENT", "COMMUNE"] as NavItem["scopes"];

// The whole menu, declared once. The sidebar shows an entry only when the
// user holds one of its permissions; the pages enforce the same permissions
// on the server.
export const NAVIGATION: NavSection[] = [
  {
    title: "Général",
    items: [
      { label: "Tableau de bord", href: "/espace", icon: Home, short: "Accueil" },
      { label: "Mes enfants", href: "/espace/suivi", icon: Baby, scopes: ["SELF"], permission: ["student:view"], tab: { family: 1 } },
      { label: "Ma scolarité", href: "/espace/suivi", icon: GraduationCap, scopes: ["SELF"], permission: ["report_card:view"], tab: { family: 1 } },
    ],
  },
  {
    title: "Pilotage",
    items: [
      { label: "Territoire", href: "/espace/territoire", icon: Map, permission: ["territory:view"], scopes: TERRITORY, tab: { territory: 1 } },
      { label: "Statistiques", href: "/espace/statistiques", icon: BarChart3, permission: ["statistics:view"], scopes: STAFF, tab: { territory: 2, school: 6 } },
      { label: "Établissements", href: "/espace/etablissements", icon: Landmark, permission: ["school:view"], scopes: TERRITORY, short: "Écoles", tab: { territory: 4 } },
      { label: "Demandes", href: "/espace/demandes", icon: Inbox, permission: ["request:view"], scopes: STAFF, tab: { territory: 3 } },
    ],
  },
  {
    title: "Vie scolaire",
    items: [
      { label: "Mon établissement", href: "/espace/mon-etablissement", icon: Landmark, permission: ["school:view"], scopes: ["SCHOOL"], short: "Établissement" },
      { label: "Classes", href: "/espace/classes", icon: LayoutGrid, permission: ["class:view"], scopes: ["SCHOOL"], tab: { school: 5, teacher: 5 } },
      { label: "Élèves", href: "/espace/eleves", icon: GraduationCap, permission: ["student:view"], scopes: ["SCHOOL"], tab: { school: 1 } },
      { label: "Enseignants", href: "/espace/enseignants", icon: UserSquare2, permission: ["teacher:view"], scopes: ["SCHOOL"] },
      { label: "Parents", href: "/espace/parents", icon: Users, permission: ["parent:view"], scopes: ["SCHOOL"] },
      { label: "Emploi du temps", href: "/espace/emploi-du-temps", icon: CalendarDays, permission: ["timetable:view"], scopes: ["SCHOOL"], short: "Horaires", tab: { teacher: 4 } },
    ],
  },
  {
    title: "Pédagogie",
    items: [
      { label: "Notes", href: "/espace/notes", icon: NotebookPen, permission: ["grade:view"], scopes: ["SCHOOL"], tab: { school: 2, teacher: 1 } },
      { label: "Bulletins", href: "/espace/bulletins", icon: FileText, permission: ["report_card:publish", "report_card:export"], scopes: ["SCHOOL"] },
      { label: "Présences", href: "/espace/presences", icon: ClipboardCheck, permission: ["attendance:view"], scopes: ["SCHOOL"], tab: { school: 4, teacher: 2 } },
    ],
  },
  {
    title: "Finances",
    items: [
      { label: "Frais et paiements", href: "/espace/frais", icon: Wallet, permission: ["fee:view", "payment:view"], scopes: ["SCHOOL"], short: "Frais", tab: { school: 3 } },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Annonces et ressources", href: "/espace/contenus", icon: Megaphone, permission: ["content:view"], short: "Annonces", tab: { family: 3, teacher: 6, school: 8, territory: 6 } },
      { label: "Messagerie", href: "/espace/messages", icon: MessagesSquare, permission: ["message:view"], short: "Messages", tab: { family: 2, teacher: 3, school: 7, territory: 5 } },
      { label: "Notifications", href: "/espace/notifications", icon: Bell },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Comptes utilisateurs", href: "/espace/utilisateurs", icon: KeyRound, permission: ["user:view"], short: "Comptes" },
      { label: "Demandes de réinitialisation", href: "/espace/aide-connexion", icon: LifeBuoy, permission: ["user:update"], scopes: STAFF, short: "Mots de passe" },
      { label: "Rôles et droits", href: "/espace/droits", icon: ShieldCheck, permission: ["role:view"], short: "Droits" },
      { label: "Journal d'activité", href: "/espace/journal", icon: ScrollText, permission: ["audit:view"], short: "Journal" },
    ],
  },
  {
    title: "Mon compte",
    items: [
      { label: "Préférences", href: "/espace/preferences", icon: Settings2 },
      { label: "Guide d'utilisation", href: "/espace/aide", icon: BookOpen, short: "Aide" },
    ],
  },
];

type NavUser = {
  permissions: Set<PermissionCode>;
  scope: { level: NonNullable<NavItem["scopes"]>[number] };
  guardianId: string | null;
  studentId: string | null;
  teacherId?: string | null;
};

export function visibleNavigation(user: NavUser): NavSection[] {
  const seen = new Set<string>();
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.scopes && !item.scopes.includes(user.scope.level)) return false;
      if (item.permission && !item.permission.some((p) => user.permissions.has(p))) return false;
      // Family entries: "Mes enfants" for parents, "Ma scolarité" for students.
      if (item.label === "Mes enfants" && !user.guardianId) return false;
      if (item.label === "Ma scolarité" && !user.studentId) return false;
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    }),
  })).filter((s) => s.items.length > 0);
}

export function tabAudience(user: Pick<NavUser, "scope" | "teacherId">): TabAudience {
  if (user.scope.level === "SELF") return "family";
  if (user.scope.level === "SCHOOL") return user.teacherId ? "teacher" : "school";
  return "territory";
}

// The phone tab bar: the dashboard, then the three best ranked entries of
// the user's own menu. Taken from the visible sections, so an entry the user
// may not open can never become a tab.
export function mobileTabs(sections: NavSection[], audience: TabAudience, count = 3): NavItem[] {
  const items = sections.flatMap((s) => s.items);
  const home = items.find((i) => i.href === "/espace");
  const ranked = items
    .filter((i) => i.href !== "/espace" && i.tab?.[audience] !== undefined)
    .sort((a, b) => a.tab![audience]! - b.tab![audience]!)
    .slice(0, count);
  return home ? [home, ...ranked] : ranked;
}

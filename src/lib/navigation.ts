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

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // Any of these permissions shows the entry. Omitted: every signed in user.
  permission?: PermissionCode[];
  // Restrict to scope levels (e.g. family entries only for SELF users).
  scopes?: ("NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF")[];
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
      { label: "Tableau de bord", href: "/espace", icon: Home },
      { label: "Mes enfants", href: "/espace/suivi", icon: Baby, scopes: ["SELF"], permission: ["student:view"] },
      { label: "Ma scolarité", href: "/espace/suivi", icon: GraduationCap, scopes: ["SELF"], permission: ["report_card:view"] },
    ],
  },
  {
    title: "Pilotage",
    items: [
      { label: "Territoire", href: "/espace/territoire", icon: Map, permission: ["territory:view"], scopes: TERRITORY },
      { label: "Statistiques", href: "/espace/statistiques", icon: BarChart3, permission: ["statistics:view"], scopes: STAFF },
      { label: "Établissements", href: "/espace/etablissements", icon: Landmark, permission: ["school:view"], scopes: TERRITORY },
      { label: "Demandes", href: "/espace/demandes", icon: Inbox, permission: ["request:view"], scopes: STAFF },
    ],
  },
  {
    title: "Vie scolaire",
    items: [
      { label: "Classes", href: "/espace/classes", icon: LayoutGrid, permission: ["class:view"], scopes: ["SCHOOL"] },
      { label: "Élèves", href: "/espace/eleves", icon: GraduationCap, permission: ["student:view"], scopes: ["SCHOOL"] },
      { label: "Enseignants", href: "/espace/enseignants", icon: UserSquare2, permission: ["teacher:view"], scopes: ["SCHOOL"] },
      { label: "Parents", href: "/espace/parents", icon: Users, permission: ["parent:view"], scopes: ["SCHOOL"] },
      { label: "Emploi du temps", href: "/espace/emploi-du-temps", icon: CalendarDays, permission: ["timetable:view"], scopes: ["SCHOOL"] },
    ],
  },
  {
    title: "Pédagogie",
    items: [
      { label: "Notes", href: "/espace/notes", icon: NotebookPen, permission: ["grade:view"], scopes: ["SCHOOL"] },
      { label: "Bulletins", href: "/espace/bulletins", icon: FileText, permission: ["report_card:publish", "report_card:export"], scopes: ["SCHOOL"] },
      { label: "Présences", href: "/espace/presences", icon: ClipboardCheck, permission: ["attendance:view"], scopes: ["SCHOOL"] },
    ],
  },
  {
    title: "Finances",
    items: [{ label: "Frais et paiements", href: "/espace/frais", icon: Wallet, permission: ["fee:view", "payment:view"], scopes: ["SCHOOL"] }],
  },
  {
    title: "Communication",
    items: [
      { label: "Annonces et ressources", href: "/espace/contenus", icon: Megaphone, permission: ["content:view"] },
      { label: "Messagerie", href: "/espace/messages", icon: MessagesSquare, permission: ["message:view"] },
      { label: "Notifications", href: "/espace/notifications", icon: Bell },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Comptes utilisateurs", href: "/espace/utilisateurs", icon: KeyRound, permission: ["user:view"] },
      { label: "Rôles et droits", href: "/espace/droits", icon: ShieldCheck, permission: ["role:view"] },
      { label: "Journal d'activité", href: "/espace/journal", icon: ScrollText, permission: ["audit:view"] },
    ],
  },
  {
    title: "Mon compte",
    items: [
      { label: "Accessibilité", href: "/espace/preferences", icon: Settings2 },
      { label: "Guide d'utilisation", href: "/espace/aide", icon: BookOpen },
    ],
  },
];

type NavUser = { permissions: Set<PermissionCode>; scope: { level: NonNullable<NavItem["scopes"]>[number] }; guardianId: string | null; studentId: string | null };

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

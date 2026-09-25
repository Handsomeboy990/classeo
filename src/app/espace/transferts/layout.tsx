import { requirePermission } from "@/lib/auth/authorize";

// Section gate, checked before any loading boundary streams. Staff and
// families with the right to see a pupil (a student through their report
// cards) reach the transfers they are concerned by; each page scopes them.
export default async function Layout({ children }: LayoutProps<"/espace/transferts">) {
  await requirePermission(["student:view", "report_card:view"]);
  return children;
}

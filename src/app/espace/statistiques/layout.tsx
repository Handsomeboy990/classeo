import { requirePermission } from "@/lib/auth/authorize";

// Section gate, checked before any loading boundary streams: a refused user
// gets a real 403 status, not only the forbidden page.
export default async function Layout({ children }: LayoutProps<"/espace/statistiques">) {
  // The connections page needs connection:view only (see its own check).
  await requirePermission(["statistics:view", "connection:view"]);
  return children;
}

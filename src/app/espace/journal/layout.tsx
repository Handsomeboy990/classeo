import { requirePermission } from "@/lib/auth/authorize";

// Section gate, checked before any loading boundary streams: a refused user
// gets a real 403 status, not only the forbidden page.
export default async function Layout({ children }: LayoutProps<"/espace/journal">) {
  await requirePermission("audit:view");
  return children;
}

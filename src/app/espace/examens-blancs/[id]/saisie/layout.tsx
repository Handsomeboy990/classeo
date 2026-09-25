import { requirePermission } from "@/lib/auth/authorize";

// Checked before the loading skeleton streams: an account that cannot enter
// results gets a real 403.
export default async function Layout({ children }: LayoutProps<"/espace/examens-blancs/[id]/saisie">) {
  await requirePermission("mock_exam:update");
  return children;
}

import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/authorize";
import { isEnabled } from "@/lib/features";

// Section gate, checked before any loading boundary streams: a refused user
// gets a real 403, and the whole section disappears when the option is off.
export default async function Layout({ children }: LayoutProps<"/espace/examens-blancs">) {
  await requirePermission("mock_exam:view");
  if (!(await isEnabled("exams.mock"))) notFound();
  return children;
}

import { forbidden } from "next/navigation";

import { signatureTabs } from "@/features/signatures/nav";
import { requireUser } from "@/lib/auth/session";

// Section gate, checked before any loading boundary streams: an account with
// no tab of the section gets a real 403 status. Each page checks its own
// right again.
export default async function Layout({ children }: LayoutProps<"/espace/signature">) {
  const user = await requireUser();
  if (!signatureTabs(user).length) forbidden();
  return children;
}

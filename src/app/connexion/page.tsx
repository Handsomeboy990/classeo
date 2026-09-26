import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInPage } from "@/features/auth/sign-in-page";
import { getCurrentUser } from "@/lib/auth/session";
import { showPublicDemoPanel } from "@/lib/demo/access";
import { resolveDemoPassword } from "@/lib/demo/password";

export const metadata: Metadata = { title: "Connexion" };

// The public sign in page. The demonstration panel shows on a development
// machine only (src/lib/demo/access.ts); a deployment offers it at the secret
// address of src/app/acces/[token] instead.
export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  if (await getCurrentUser()) redirect("/espace");
  const demo = showPublicDemoPanel() ? { password: resolveDemoPassword() } : null;
  return <SignInPage searchParams={await searchParams} demo={demo} />;
}

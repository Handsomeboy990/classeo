import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { param } from "@/lib/list";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  if (await getCurrentUser()) redirect("/espace");
  const sp = await searchParams;
  const showDemo = process.env.DEMO_MODE !== "off";

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-text lg:flex lg:flex-col lg:justify-between" aria-hidden>
        <Logo tone="inverse" />
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl leading-tight font-bold">
            Une école, un territoire,
            <span className="text-accent"> une seule plateforme.</span>
          </p>
          <p className="mt-4 text-sidebar-muted">
            Du ministère à la salle de classe, Classéo relie les directions départementales, les circonscriptions, les écoles, les enseignants, les
            élèves et les familles, y compris ceux qui ne lisent pas ou ne voient pas.
          </p>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full">
          <span className="w-2/5 bg-[#008751]" />
          <span className="w-2/5 bg-accent" />
          <span className="w-1/5 bg-[#E8112D]" />
        </div>
        <svg className="absolute -right-24 -bottom-24 size-[28rem] opacity-15" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="30" fill="#FCD116" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="49" y="2" width="2" height="12" rx="1" fill="#FCD116" transform={`rotate(${i * 30} 50 50)`} />
          ))}
        </svg>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <h1 className="mt-8 text-3xl font-bold lg:mt-0">Connexion</h1>
          <p className="mt-1 mb-6 text-muted">Accédez à votre espace selon votre rôle.</p>
          <LoginForm next={param(sp, "next")} showDemo={showDemo} />
        </div>
      </section>
    </main>
  );
}

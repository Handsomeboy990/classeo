import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { FlagStripe, SunriseMotif } from "@/components/brand/sunrise";
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
      {/* The home page's hero, condensed: same slogan, same bright flag
          yellow sun standing on the flag stripe, never cut by it. */}
      <section className="relative hidden flex-col overflow-hidden bg-sidebar text-sidebar-text lg:sticky lg:top-0 lg:flex lg:h-dvh" aria-hidden>
        <div className="px-12 pt-12">
          <Logo tone="inverse" />
        </div>
        <div className="relative z-10 my-auto max-w-lg px-12 py-10">
          <p className="text-sm font-bold tracking-[0.14em] text-balance text-accent uppercase">République du Bénin · Plateforme nationale de l&apos;éducation</p>
          <p className="mt-4 font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-balance">
            L&apos;école béninoise, du ministère <span className="text-accent">à la maison.</span>
          </p>
          <p className="mt-5 text-lg text-sidebar-muted">
            Statistiques, établissements, notes, bulletins, présences, frais et messagerie : le ministère, les écoles et les familles travaillent sur les mêmes
            données.
          </p>
        </div>
        <SunriseMotif still className="mr-6 w-[30rem] max-w-[80%] shrink-0 self-end" />
        <FlagStripe className="shrink-0" />
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <h1 className="mt-8 text-3xl font-bold lg:mt-0">Connexion</h1>
          <p className="mt-1 mb-6 text-muted">Avec l&apos;identifiant et le mot de passe remis par votre établissement ou votre administration.</p>
          <LoginForm next={param(sp, "next")} showDemo={showDemo} />
        </div>
      </section>
    </main>
  );
}

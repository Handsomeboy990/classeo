import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BeninFlag } from "@/components/brand/flag";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { param } from "@/lib/list";

import cour from "../../../public/images/cour-de-recreation.webp";

export const metadata: Metadata = { title: "Connexion" };

// Sign in. Large screens: a photograph of a Beninese school yard beside a
// plain form card. Phones: the form first, under a short strip of the same
// photograph.
export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  if (await getCurrentUser()) redirect("/espace");
  const sp = await searchParams;
  const showDemo = process.env.DEMO_MODE !== "off";

  return (
    <main id="page-content" tabIndex={-1} className="grid min-h-dvh bg-bg outline-none lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)]">
      <section className="relative hidden overflow-hidden bg-sidebar lg:sticky lg:top-0 lg:block lg:h-dvh" aria-label="Photographie">
        <Image
          src={cour}
          alt="Cour de l'école primaire publique de Savi, à Godomey : des élèves en uniforme kaki, une petite fille salue au premier plan."
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 1px"
          className="object-cover object-[20%_50%]"
          placeholder="blur"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-12 pt-32 pb-10 text-white">
          <p className="max-w-lg font-display text-4xl leading-tight font-bold text-balance">L&apos;école béninoise, du ministère à la maison.</p>
          <p className="mt-3 text-sm text-white/85">École primaire publique de Savi, Godomey. Photo : Rofik Adam, CC BY-SA 4.0.</p>
        </div>
      </section>

      <section className="flex flex-col">
        <div className="relative h-28 overflow-hidden bg-sidebar sm:h-36 lg:hidden" aria-hidden>
          <Image src={cour} alt="" fill sizes="100vw" className="object-cover object-[50%_40%]" placeholder="blur" data-decorative />
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pb-10 sm:px-8 lg:items-center lg:py-12">
          <div className="-mt-10 w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-raised sm:p-8 lg:mt-0">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" aria-label="Classéo, retour à l'accueil" className="rounded-lg">
                <Logo />
              </Link>
              <span className="flex items-center gap-2 text-xs font-semibold text-muted">
                <BeninFlag className="h-3.5" />
                Bénin
              </span>
            </div>
            <h1 className="mt-7 text-2xl font-bold sm:text-3xl">Connexion</h1>
            <p className="mt-1 mb-6 text-muted">Avec l&apos;identifiant et le mot de passe remis par votre établissement ou votre administration.</p>
            <LoginForm next={param(sp, "next")} showDemo={showDemo} />
          </div>
        </div>
      </section>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

import cour from "../../../public/images/cour-de-recreation.webp";

import { RESET_CODE_MINUTES } from "./reset-code";

// Frame of the signed out pages next to the sign in page (forgotten
// password): the same school yard photograph on large screens, the form
// card alone on phones.
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main id="page-content" tabIndex={-1} className="grid min-h-dvh bg-bg outline-none lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)]">
      <section className="relative hidden overflow-hidden bg-sidebar lg:sticky lg:top-0 lg:block lg:h-dvh" aria-hidden>
        <Image src={cour} alt="" fill sizes="(min-width: 1024px) 60vw, 1px" className="object-cover object-[20%_50%]" placeholder="blur" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-12 pt-32 pb-10 text-white">
          <p className="max-w-lg font-display text-3xl leading-tight font-bold text-balance">Mot de passe oublié : un code par e-mail.</p>
          <p className="mt-3 max-w-lg text-white/85">
            Le code est à usage unique et reste valable {RESET_CODE_MINUTES} minutes. Une fois le mot de passe changé, toutes les sessions ouvertes avec le compte sont
            fermées.
          </p>
        </div>
      </section>
      <section className="flex items-start justify-center px-4 py-10 sm:px-8 lg:items-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-raised sm:p-8">
          <Link href="/" aria-label="Classéo, retour à l'accueil" className="inline-block rounded-lg">
            <Logo />
          </Link>
          <h1 className="mt-7 text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-1 mb-6 text-muted">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

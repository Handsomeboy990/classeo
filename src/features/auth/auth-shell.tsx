import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

// Frame of the signed out pages that sit next to the sign in page: the same
// brand panel on large screens, the form alone on phones.
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-text lg:flex lg:flex-col lg:justify-between" aria-hidden>
        <Logo tone="inverse" />
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl leading-tight font-bold">
            Un accès perdu
            <span className="text-accent"> se retrouve en quelques minutes.</span>
          </p>
          <p className="mt-4 text-sidebar-muted">
            Un code à usage unique est envoyé à l&apos;adresse e-mail de votre compte. Il reste valable un quart d&apos;heure et ferme toutes les
            sessions ouvertes une fois le mot de passe changé.
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
          <h1 className="mt-8 text-3xl font-bold lg:mt-0">{title}</h1>
          <p className="mt-1 mb-6 text-muted">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

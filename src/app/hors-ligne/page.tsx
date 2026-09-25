import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ReadAloud } from "@/components/kit/read-aloud";
import { CachedPages } from "@/features/pwa/cached-pages";

export const metadata: Metadata = { title: "Hors ligne" };
export const dynamic = "force-static";

const MESSAGE =
  "Pas de réseau pour le moment. Les pages déjà ouvertes sur cet appareil restent lisibles : bulletins, notes, présences et emploi du temps. Pour enregistrer une modification, il faut le réseau.";

// Shown by the service worker when a page is requested without network and
// no copy of it is kept on the device. Static: no database, no session.
export default function OfflinePage() {
  return (
    <main id="page-content" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 py-10 outline-none">
      <Link href="/" aria-label="Classéo, accueil" className="self-start">
        <Logo />
      </Link>
      <div className="flex flex-col gap-4">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-sidebar text-accent" aria-hidden>
          <WifiOff className="size-8" />
        </span>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Vous êtes hors ligne</h1>
        <p className="text-lg text-muted">{MESSAGE}</p>
        <ReadAloud text={MESSAGE} label="Écouter" className="self-start" />
      </div>
      <section aria-labelledby="saved-title" className="flex flex-col gap-3">
        <h2 id="saved-title" className="text-xl font-bold">
          Disponibles sur cet appareil
        </h2>
        <CachedPages />
      </section>
    </main>
  );
}

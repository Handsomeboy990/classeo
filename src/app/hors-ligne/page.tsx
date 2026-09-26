import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ReadAloud } from "@/components/kit/read-aloud";
import { StatusPage } from "@/components/kit/status-page";
import { CachedPages } from "@/features/pwa/cached-pages";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Hors ligne", robots: NO_INDEX };
export const dynamic = "force-static";

const MESSAGE = "Pas de réseau pour le moment. Les pages déjà ouvertes sur cet appareil restent lisibles ; pour enregistrer une modification, il faut le réseau.";

// Shown by the service worker when a page is requested without network and
// no copy of it is kept on the device. Static: no database, no session.
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-8">
          <Link href="/" aria-label="Classéo, accueil" className="rounded-lg">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="page-content" tabIndex={-1} className="flex-1 outline-none">
        <StatusPage icon={<WifiOff />} title="Vous êtes hors ligne" actions={<ReadAloud text={MESSAGE} label="Écouter" />}>
          <p>{MESSAGE}</p>
        </StatusPage>
        <section aria-labelledby="saved-title" className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-5 pb-16">
          <h2 id="saved-title" className="text-lg font-bold">
            Disponibles sur cet appareil
          </h2>
          <CachedPages />
        </section>
      </main>
    </div>
  );
}

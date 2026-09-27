import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

import { ReadAloud } from "@/components/kit/read-aloud";
import { StatusPage } from "@/components/kit/status-page";
import { FrenchPublicPage } from "@/features/public-pages/public-frame";
import { CachedPages } from "@/features/pwa/cached-pages";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Hors ligne", robots: NO_INDEX };
export const dynamic = "force-static";

const MESSAGE = "Pas de réseau pour le moment. Les pages déjà ouvertes sur cet appareil restent lisibles ; pour enregistrer une modification, il faut le réseau.";

// Shown by the service worker when a page is requested without network and
// no copy of it is kept on the device. Static: no session; the brand options
// are read at build time (their defaults without a database).
export default function OfflinePage() {
  return (
    <FrenchPublicPage>
      <StatusPage icon={<WifiOff />} title="Vous êtes hors ligne" actions={<ReadAloud text={MESSAGE} label="Écouter" />}>
        <p>{MESSAGE}</p>
      </StatusPage>
      <section aria-labelledby="saved-title" className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-5 pb-16">
        <h2 id="saved-title" className="text-[1.25rem] leading-snug font-bold">
          Disponibles sur cet appareil
        </h2>
        <CachedPages />
      </section>
    </FrenchPublicPage>
  );
}

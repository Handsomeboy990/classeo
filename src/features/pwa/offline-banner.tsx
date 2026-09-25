"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Visible and announced when the connection drops: the kept pages stay
// readable, grades, registers and messages are queued (src/features/offline).
export function OfflineBanner() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  return (
    <div role="status" aria-live="polite" data-offline-banner>
      {offline && (
        <p className="flex items-start justify-center gap-2 bg-sidebar px-4 py-2.5 text-center text-sm font-semibold text-sidebar-text sm:items-center">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-accent sm:mt-0" aria-hidden />
          <span>
            Vous êtes hors ligne. Les pages gardées sur cet appareil restent consultables. Les notes, les appels et les messages saisis sont gardés et envoyés au retour du réseau.
          </span>
        </p>
      )}
    </div>
  );
}

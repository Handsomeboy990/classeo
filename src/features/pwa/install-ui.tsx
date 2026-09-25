"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { toast } from "@/components/kit/toaster";
import { Button } from "@/components/ui/button";

import { dismissInstallOffer, promptInstall, useInstallMode, useInstallOffer } from "./install";

async function install() {
  try {
    if (await promptInstall()) toast("success", "Classéo s'installe sur cet appareil.");
  } catch {
    toast("error", "L'installation n'a pas pu démarrer. Réessayez depuis le menu du navigateur.");
  }
}

// The Safari steps, with the icons the user will see on screen.
function IosSteps() {
  return (
    <ol className="mt-1 flex flex-col gap-1 text-sm text-muted">
      <li className="flex items-center gap-1.5">
        <span className="font-semibold text-text">1.</span> Touchez
        <Share className="size-4 text-info" aria-hidden />
        <span className="font-semibold text-text">Partager</span> dans la barre de Safari.
      </li>
      <li className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-text">2.</span> Choisissez
        <SquarePlus className="size-4 text-text" aria-hidden />
        <span className="font-semibold text-text">« Sur l&apos;écran d&apos;accueil »</span>.
      </li>
    </ol>
  );
}

// Invitation shown once, above the page content of the private space (and
// outside the region read aloud), when this browser can install the app.
// Dismissed for good with the close button.
export function InstallCard() {
  const offer = useInstallOffer();
  const mode = useInstallMode();
  if (!offer) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:pt-6">
      <section aria-labelledby="install-card-title" className="flex items-start gap-3 rounded-card border border-border bg-surface p-3 pr-1.5 shadow-sm sm:p-4 sm:pr-2">
        <LogoMark className="size-11" />
        <div className="min-w-0 flex-1">
          <h2 id="install-card-title" className="font-sans text-base font-bold">
            Installer Classéo sur cet appareil
          </h2>
          {mode === "ios" ? (
            <IosSteps />
          ) : (
            <>
              <p className="text-sm text-muted">Ouverture depuis l&apos;écran d&apos;accueil, en plein écran, et pages consultables sans réseau.</p>
              <Button type="button" className="mt-3" onClick={install}>
                <Download aria-hidden />
                Installer
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismissInstallOffer}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Ne plus proposer l'installation"
        >
          <X className="size-5" aria-hidden />
        </button>
      </section>
    </div>
  );
}

// Entry of the account sheet. Absent when the app is already installed or
// the browser cannot install it.
export function InstallEntry({ className }: { className?: string }) {
  const mode = useInstallMode();
  const [steps, setSteps] = useState(false);
  if (mode !== "prompt" && mode !== "ios") return null;

  return (
    <li>
      <button type="button" className={className} onClick={() => (mode === "ios" ? setSteps((s) => !s) : install())} aria-expanded={mode === "ios" ? steps : undefined}>
        <Download aria-hidden />
        <span className="flex-1 text-left">Installer l&apos;application</span>
      </button>
      {steps && (
        <div className="mx-3 mb-2 rounded-lg bg-surface-2 px-3 py-2">
          <IosSteps />
        </div>
      )}
    </li>
  );
}

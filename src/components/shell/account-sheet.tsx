"use client";

import { Accessibility, BookOpen, ChevronRight, LogOut, MapPin, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { InstallEntry } from "@/features/pwa/install-ui";
import { PushToggle } from "@/features/push/push-toggle";

import { AccessibilityPanel } from "./accessibility-panel";
import { Sheet } from "./sheet";
import { SignOutButton } from "./sign-out-button";

export type ShellUser = { fullName: string; email: string; roleName: string; scopeLabel: string };

const ROW =
  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 font-medium text-text hover:bg-surface-2 active:bg-surface-2 [&>svg:first-child]:size-5 [&>svg:first-child]:shrink-0 [&>svg:first-child]:text-muted";

// Opened from the avatar of the phone app bar: who is signed in, with which
// role and over which territory, then this device's settings and sign out.
// "Accessibilité" opens the same settings as the floating button, which is
// hidden on pages with a save bar at the bottom.
export function AccountSheet({ open, onClose, user, pushKey }: { open: boolean; onClose: () => void; user: ShellUser; pushKey: string | null }) {
  const [a11y, setA11y] = useState(false);
  return (
    <>
    <Sheet
      open={open}
      onClose={onClose}
      title="Mon compte"
      lead={
        <div className="flex items-center gap-3 pt-1">
          <Avatar name={user.fullName} className="size-12 text-base" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight font-bold">{user.fullName}</p>
            <p className="truncate text-sm text-muted">{user.roleName}</p>
          </div>
        </div>
      }
    >
      <p className="flex items-center gap-1.5 px-1 pt-1 pb-4 text-sm text-muted">
        <MapPin className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Périmètre :</span>
        <span className="truncate">{user.scopeLabel}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{user.email}</span>
      </p>

      <div className="rounded-card border border-border">
        <PushToggle publicKey={pushKey} className="border-b border-border last:border-b-0" />
        <ul className="p-1">
          <li>
            <button
              type="button"
              className={ROW}
              aria-haspopup="dialog"
              onClick={() => {
                onClose();
                setA11y(true);
              }}
            >
              <Accessibility aria-hidden />
              <span className="flex-1 text-left">Accessibilité</span>
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </button>
          </li>
          <InstallEntry className={ROW} />
          <li>
            <Link href="/espace/preferences" onClick={onClose} className={ROW}>
              <Settings2 aria-hidden />
              <span className="flex-1">Préférences</span>
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          </li>
          <li>
            <Link href="/espace/aide" onClick={onClose} className={ROW}>
              <BookOpen aria-hidden />
              <span className="flex-1">Guide d&apos;utilisation</span>
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          </li>
        </ul>
      </div>

      <div className="mt-4">
        <SignOutButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border-strong font-semibold text-danger hover:bg-danger-soft active:bg-danger-soft">
          <LogOut className="size-5" aria-hidden />
          Se déconnecter
        </SignOutButton>
      </div>
    </Sheet>
    <AccessibilityPanel open={a11y} onClose={() => setA11y(false)} />
    </>
  );
}

"use client";

import { Power, PowerOff } from "lucide-react";

import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button } from "@/components/ui/button";

import { setSchoolActive } from "../actions";

export function SchoolStatusButton({ id, name, isActive, size = "md" }: { id: string; name: string; isActive: boolean; size?: "sm" | "md" }) {
  return (
    <ConfirmAction
      action={setSchoolActive}
      fields={{ id, active: String(!isActive) }}
      title={isActive ? `Désactiver ${name} ?` : `Réactiver ${name} ?`}
      description={
        isActive
          ? "L'établissement n'apparaîtra plus comme actif. Ses données sont conservées et il pourra être réactivé à tout moment."
          : "L'établissement redevient actif et visible comme tel dans les statistiques."
      }
      confirmLabel={isActive ? "Désactiver" : "Réactiver"}
      tone={isActive ? "danger" : "primary"}
      trigger={(open) => (
        <Button variant={isActive ? "danger-ghost" : "secondary"} size={size} onClick={open} aria-label={`${isActive ? "Désactiver" : "Réactiver"} ${name}`}>
          {isActive ? <PowerOff aria-hidden /> : <Power aria-hidden />}
          {isActive ? "Désactiver" : "Réactiver"}
        </Button>
      )}
    />
  );
}

"use client";

import { UserMinus, UserPlus, UserX } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import { setEnrollmentStatus } from "../actions";

type Status = "ACTIVE" | "TRANSFERRED" | "WITHDRAWN";

const COPY: Record<Status, { title: (n: string) => string; description: (c: string) => string; confirm: string }> = {
  TRANSFERRED: {
    title: (n) => `Transférer ${n} ?`,
    description: () => "L'élève quitte l'établissement pour un autre. Ses notes et présences restent consultables.",
    confirm: "Transférer",
  },
  WITHDRAWN: {
    title: (n) => `Retirer ${n} de l'établissement ?`,
    description: () => "L'élève n'apparaîtra plus dans les appels, les fiches de notes ni les bulletins. Vous pourrez le réinscrire.",
    confirm: "Retirer",
  },
  ACTIVE: {
    title: (n) => `Réinscrire ${n} ?`,
    description: (c) => `L'élève retrouve sa place en ${c} si la classe n'est pas complète.`,
    confirm: "Réinscrire",
  },
};

// One form that stays mounted whatever the status, so the result toast is
// shown even though the buttons change once the status does.
export function EnrollmentStatusActions({ enrollmentId, status, name, className }: { enrollmentId: string; status: Status; name: string; className: string }) {
  const [target, setTarget] = useState<Status | null>(null);
  const copy = target ? COPY[target] : null;
  return (
    <>
      {status === "ACTIVE" ? (
        <>
          <Button variant="secondary" onClick={() => setTarget("TRANSFERRED")}>
            <UserMinus aria-hidden /> Transférer
          </Button>
          <Button variant="danger" onClick={() => setTarget("WITHDRAWN")}>
            <UserX aria-hidden /> Retirer
          </Button>
        </>
      ) : (
        <Button onClick={() => setTarget("ACTIVE")}>
          <UserPlus aria-hidden /> Réinscrire
        </Button>
      )}
      <Dialog open={!!target} onClose={() => setTarget(null)} title={copy?.title(name) ?? ""}>
        {copy && (
          <>
            <p className="text-sm text-muted">{copy.description(className)}</p>
            <ActionForm action={setEnrollmentStatus} onSuccess={() => setTarget(null)} className="mt-5 flex justify-end gap-2">
              <input type="hidden" name="enrollmentId" value={enrollmentId} />
              <input type="hidden" name="status" value={target!} />
              <Button type="button" variant="secondary" onClick={() => setTarget(null)}>
                Annuler
              </Button>
              <SubmitButton variant={target === "ACTIVE" ? "primary" : "danger"} pendingLabel="Traitement…">
                {copy.confirm}
              </SubmitButton>
            </ActionForm>
          </>
        )}
      </Dialog>
    </>
  );
}

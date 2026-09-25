"use client";

import { KeyRound, LogOut, Power, PowerOff } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmAction } from "@/components/kit/confirm-action";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import { resetUserPassword, revokeUserSessions, setUserActive } from "../actions";
import { TemporaryPassword } from "./temporary-password";

export function UserRowActions({ id, name, isActive, sessions }: { id: string; name: string; isActive: boolean; sessions: number }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <ResetPassword id={id} name={name} />
      {sessions > 0 && (
        <ConfirmAction
          action={revokeUserSessions}
          fields={{ id }}
          title={`Fermer les sessions de ${name} ?`}
          description="Toutes les sessions ouvertes de ce compte seront fermées. La personne devra se reconnecter."
          confirmLabel="Fermer les sessions"
          tone="primary"
          trigger={(open) => (
            <Button variant="ghost" size="sm" onClick={open} aria-label={`Fermer les sessions de ${name}`} title="Fermer les sessions">
              <LogOut aria-hidden />
              <span className="max-xl:sr-only">Sessions</span>
            </Button>
          )}
        />
      )}
      <ConfirmAction
        action={setUserActive}
        fields={{ id, active: String(!isActive) }}
        title={isActive ? `Désactiver le compte de ${name} ?` : `Réactiver le compte de ${name} ?`}
        description={isActive ? "La personne ne pourra plus se connecter et ses sessions ouvertes seront fermées. Le compte pourra être réactivé." : "La personne pourra de nouveau se connecter."}
        confirmLabel={isActive ? "Désactiver" : "Réactiver"}
        tone={isActive ? "danger" : "primary"}
        trigger={(open) => (
          <Button variant="ghost" size="sm" onClick={open} aria-label={`${isActive ? "Désactiver" : "Réactiver"} le compte de ${name}`} title={isActive ? "Désactiver" : "Réactiver"}>
            {isActive ? <PowerOff aria-hidden /> : <Power aria-hidden />}
            <span className="max-xl:sr-only">{isActive ? "Désactiver" : "Réactiver"}</span>
          </Button>
        )}
      />
    </div>
  );
}

function ResetPassword({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  function close() {
    setOpen(false);
    setResult(null);
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Réinitialiser le mot de passe de ${name}`} title="Réinitialiser le mot de passe">
        <KeyRound aria-hidden />
        <span className="max-xl:sr-only">Mot de passe</span>
      </Button>
      <Dialog open={open} onClose={close} title={result ? "Mot de passe réinitialisé" : `Réinitialiser le mot de passe de ${name} ?`}>
        {result ? (
          <TemporaryPassword email={result.email} password={result.password} onDone={close} />
        ) : (
          <>
            <p className="text-sm text-muted">Un mot de passe temporaire sera généré et affiché une seule fois. Les sessions ouvertes seront fermées et la personne devra le changer à sa prochaine connexion.</p>
            <ActionForm
              action={resetUserPassword}
              successToast={false}
              onSuccess={(state) => {
                const data = state?.data as { email: string; password: string } | undefined;
                if (data) setResult(data);
              }}
              className="mt-5 flex justify-end gap-2"
            >
              <input type="hidden" name="id" value={id} />
              <Button type="button" variant="secondary" onClick={close}>
                Annuler
              </Button>
              <SubmitButton variant="danger" pendingLabel="Réinitialisation…">
                Réinitialiser
              </SubmitButton>
            </ActionForm>
          </>
        )}
      </Dialog>
    </>
  );
}

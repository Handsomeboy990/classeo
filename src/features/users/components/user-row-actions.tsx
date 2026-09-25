"use client";

import { KeyRound, LogOut, Power, PowerOff, UserCog } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmAction } from "@/components/kit/confirm-action";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { changeUserRole, resetUserPassword, revokeUserSessions, setUserActive } from "../actions";
import { TemporaryPassword, type IssuedPassword } from "./temporary-password";

// Row actions of the accounts table. In the table (from 40rem) they are
// icon buttons on one line, each naming itself in a label shown on hover
// and on keyboard focus; on a phone card they share the width of the card,
// each with its short label under the icon.
export function UserRowActions({
  id,
  name,
  isActive,
  sessions,
  roleId,
  roles,
}: {
  id: string;
  name: string;
  isActive: boolean;
  sessions: number;
  roleId: string;
  // Roles of the same level the viewer may give to this account.
  roles: { id: string; name: string }[];
}) {
  return (
    <div className="grid w-full auto-cols-fr grid-flow-col gap-1.5 sm:flex sm:w-auto sm:justify-end sm:gap-1">
      <ResetPassword id={id} name={name} />
      {roles.some((r) => r.id !== roleId) && <ChangeRole id={id} name={name} roleId={roleId} roles={roles} />}
      {sessions > 0 && (
        <ConfirmAction
          action={revokeUserSessions}
          fields={{ id }}
          title={`Fermer les sessions de ${name} ?`}
          description="Toutes les sessions ouvertes de ce compte seront fermées. La personne devra se reconnecter."
          confirmLabel="Fermer les sessions"
          tone="primary"
          trigger={(open) => (
            <RowAction label={`Fermer les sessions de ${name}`} tip="Fermer les sessions" short="Sessions" onClick={open}>
              <LogOut aria-hidden />
            </RowAction>
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
          <RowAction
            label={`${isActive ? "Désactiver" : "Réactiver"} le compte de ${name}`}
            tip={isActive ? "Désactiver le compte" : "Réactiver le compte"}
            short={isActive ? "Désactiver" : "Réactiver"}
            onClick={open}
            danger={isActive}
          >
            {isActive ? <PowerOff aria-hidden /> : <Power aria-hidden />}
          </RowAction>
        )}
      />
    </div>
  );
}

function RowAction({ label, tip, short, onClick, danger = false, children }: { label: string; tip: string; short: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <span className="group/tip relative flex sm:inline-flex">
      <Button type="button" variant={danger ? "danger-ghost" : "ghost"} size="sm" onClick={onClick} aria-label={label}
        className="max-sm:h-auto max-sm:min-h-11 max-sm:w-full max-sm:flex-col max-sm:gap-1 max-sm:px-1 max-sm:py-2 max-sm:text-xs sm:w-9 sm:px-0"
      >
        {children}
        <span className="sm:hidden" aria-hidden>
          {short}
        </span>
      </Button>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 hidden rounded-md bg-text px-2 py-1 text-xs font-semibold whitespace-nowrap text-bg shadow-card",
          "sm:group-hover/tip:block sm:group-has-[:focus-visible]/tip:block",
        )}
      >
        {tip}
      </span>
    </span>
  );
}

function ResetPassword({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<IssuedPassword | null>(null);
  function close() {
    setOpen(false);
    setResult(null);
  }
  return (
    <>
      <RowAction label={`Réinitialiser le mot de passe de ${name}`} tip="Réinitialiser le mot de passe" short="Mot de passe" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden />
      </RowAction>
      <Dialog open={open} onClose={close} title={result ? "Mot de passe réinitialisé" : `Réinitialiser le mot de passe de ${name} ?`} size="sm">
        {result ? (
          <TemporaryPassword {...result} onDone={close} />
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted">
              Un mot de passe temporaire sera créé et affiché une seule fois, avec l&apos;identifiant du compte ; il est aussi envoyé par e-mail si le compte a une adresse. Ses sessions ouvertes seront fermées et elle devra le changer à sa
              prochaine connexion.
            </p>
            <ActionForm
              action={resetUserPassword}
              successToast={false}
              onSuccess={(state) => {
                const data = state?.data as IssuedPassword | undefined;
                if (data) setResult(data);
              }}
              className="ds-dialog-actions mt-5"
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

function ChangeRole({ id, name, roleId, roles }: { id: string; name: string; roleId: string; roles: { id: string; name: string }[] }) {
  return (
    <span className="group/tip relative flex sm:inline-flex">
      <FormDialog
        action={changeUserRole}
        title={`Changer le rôle de ${name}`}
        description="Seuls les rôles du même niveau que vous pouvez attribuer sont proposés. Le périmètre du compte ne change pas."
        submitLabel="Changer le rôle"
        triggerVariant="ghost"
        triggerSize="sm"
        triggerLabel={`Changer le rôle de ${name}`}
        triggerClassName="max-sm:h-auto max-sm:min-h-11 max-sm:w-full max-sm:flex-col max-sm:gap-1 max-sm:px-1 max-sm:py-2 max-sm:text-xs sm:w-9 sm:px-0"
        trigger={
          <>
            <UserCog aria-hidden />
            <span className="sm:hidden" aria-hidden>
              Rôle
            </span>
          </>
        }
      >
        <input type="hidden" name="id" value={id} />
        <FormField label="Nouveau rôle" name="roleId" required>
          <Select defaultValue={roleId}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>
      </FormDialog>
    </span>
  );
}

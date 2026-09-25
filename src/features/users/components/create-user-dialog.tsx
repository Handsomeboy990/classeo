"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";

import { createUser } from "../actions";
import { TemporaryPassword, type IssuedPassword } from "./temporary-password";

type Level = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";
type RoleOption = { id: string; name: string; scopeLevel: Level };
type EntityOption = { id: string; label: string; group?: string };

const ENTITY_LABEL: Record<"DEPARTMENT" | "COMMUNE" | "SCHOOL", string> = {
  DEPARTMENT: "Département",
  COMMUNE: "Commune (circonscription)",
  SCHOOL: "Établissement",
};

// Create an account. Only the roles the user may assign are offered, and the
// scope select follows the level of the chosen role; the server checks both
// again (lib/domain/rights.ts).
export function CreateUserDialog({ roles, entities }: { roles: RoleOption[]; entities: Record<"DEPARTMENT" | "COMMUNE" | "SCHOOL", EntityOption[]> }) {
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [created, setCreated] = useState<IssuedPassword | null>(null);
  const level = roles.find((r) => r.id === roleId)?.scopeLevel;
  const entityLevel = level === "DEPARTMENT" || level === "COMMUNE" || level === "SCHOOL" ? level : null;
  const options = entityLevel ? entities[entityLevel] : [];

  function close() {
    setOpen(false);
    setCreated(null);
    setRoleId("");
  }

  const groups = new Map<string, EntityOption[]>();
  for (const o of options) groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={roles.length === 0} title={roles.length === 0 ? "Aucun rôle ne peut être attribué avec vos droits actuels." : undefined}>
        <UserPlus aria-hidden /> Nouveau compte
      </Button>
      <Dialog open={open} onClose={close} title={created ? "Compte créé" : "Nouveau compte"} description={created ? undefined : "Seuls les rôles que vos droits permettent d'attribuer sont proposés."}>
        {created ? (
          <TemporaryPassword {...created} onDone={close} />
        ) : (
          <ActionForm
            action={createUser}
            successToast={false}
            onSuccess={(state) => {
              const data = state?.data as IssuedPassword | undefined;
              if (data) setCreated(data);
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Prénom" name="firstName" required>
                <Input autoComplete="off" maxLength={80} />
              </FormField>
              <FormField label="Nom" name="lastName" required>
                <Input autoComplete="off" maxLength={80} />
              </FormField>
            </div>
            <FormField label="Adresse e-mail" name="email" required hint="Elle sert d'identifiant de connexion.">
              <Input type="email" autoComplete="off" maxLength={200} />
            </FormField>
            <FormField label="Téléphone" name="phone">
              <Input type="tel" inputMode="tel" />
            </FormField>
            <FormField label="Rôle" name="roleId" required>
              <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Choisir un rôle</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {entityLevel && (
              <FormField key={entityLevel} label={ENTITY_LABEL[entityLevel]} name="entityId" required>
                <Select defaultValue={options.length === 1 ? options[0]!.id : ""}>
                  {options.length !== 1 && <option value="">Choisir</option>}
                  {[...groups.entries()].map(([group, items]) =>
                    group ? (
                      <optgroup key={group} label={group}>
                        {items.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      items.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))
                    ),
                  )}
                </Select>
              </FormField>
            )}
            {level === "NATIONAL" && <p className="text-sm text-muted">Ce rôle agit sur tout le territoire national.</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close}>
                Annuler
              </Button>
              <SubmitButton pendingLabel="Création…">Créer le compte</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}

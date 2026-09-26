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
type RoleOption = { id: string; name: string; scopeLevel: Level; ownerEntityId?: string | null };
type EntityOption = { id: string; label: string; group?: string };

const ENTITY_LABEL: Record<"DEPARTMENT" | "COMMUNE" | "SCHOOL", string> = {
  DEPARTMENT: "Département",
  COMMUNE: "Circonscription scolaire (commune)",
  SCHOOL: "Établissement",
};

// Create an account. Only the roles the user may assign are offered, and the
// scope select follows the level of the chosen role; the server checks both
// again (lib/domain/rights.ts).
// ownChain: the chain of the creator, when it is limited to one; its new
// national and departmental accounts belong to that chain.
export function CreateUserDialog({
  roles,
  entities,
  ownChain = null,
}: {
  roles: RoleOption[];
  entities: Record<"DEPARTMENT" | "COMMUNE" | "SCHOOL", EntityOption[]>;
  ownChain?: "PRIMARY" | "SECONDARY" | null;
}) {
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [created, setCreated] = useState<IssuedPassword | null>(null);
  const chosen = roles.find((r) => r.id === roleId);
  const level = chosen?.scopeLevel;
  const entityLevel = level === "DEPARTMENT" || level === "COMMUNE" || level === "SCHOOL" ? level : null;
  // A role owned by a school (or a commune, a department) only goes to that
  // entity: the list is narrowed to it, the server checks it again.
  const options = entityLevel ? entities[entityLevel].filter((o) => !chosen?.ownerEntityId || o.id === chosen.ownerEntityId) : [];

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
      <Dialog open={open} onClose={close} title={created ? "Compte créé" : "Nouveau compte"} description={created ? undefined : "La liste ne propose que les rôles que vos droits permettent d'attribuer."}>
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
            <FormField label="Adresse e-mail" name="email" hint="Facultatif. La personne se connecte avec l'identifiant créé à partir de ses prénom et nom.">
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
            {(level === "DEPARTMENT" || level === "NATIONAL") && !ownChain && (
              <FormField key={`chain-${level}`} label={level === "DEPARTMENT" ? "Direction" : "Ministère"} name="chain" required={level === "DEPARTMENT"}>
                <Select defaultValue="">
                  <option value="">{level === "DEPARTMENT" ? "Choisir" : "Les deux ministères"}</option>
                  <option value="PRIMARY">{level === "DEPARTMENT" ? "DDEMP, maternel et primaire" : "MEMP, maternel et primaire"}</option>
                  <option value="SECONDARY">{level === "DEPARTMENT" ? "DDESTFP, secondaire, technique et formation professionnelle" : "MESTFP, secondaire, technique et formation professionnelle"}</option>
                </Select>
              </FormField>
            )}
            {level === "NATIONAL" && <p className="text-sm text-muted">Ce rôle agit sur tout le territoire national.</p>}
            <div className="ds-dialog-actions">
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

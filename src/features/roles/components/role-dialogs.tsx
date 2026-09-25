"use client";

import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { FormField } from "@/components/kit/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";

import { createRole, deleteRole, updateRoleDetails } from "../actions";

type Level = "NATIONAL" | "DEPARTMENT" | "COMMUNE" | "SCHOOL" | "SELF";
type RoleOption = { id: string; name: string; scopeLevel: Level };
type LevelOption = { value: Level; label: string };

// Create a role, empty or copied from another. Only the levels at or below
// the viewer's are offered; the server checks the level and keeps only the
// permissions the viewer holds (planRoleCreate).
export function RoleFormDialog({
  mode,
  roles,
  levels,
  source,
}: {
  mode: "create" | "duplicate";
  roles: RoleOption[];
  levels: LevelOption[];
  source?: RoleOption & { description: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allowed = (l: Level | undefined) => (l && levels.some((o) => o.value === l) ? l : undefined);
  const initialLevel = allowed(source?.scopeLevel) ?? levels[levels.length - 1]?.value ?? "SCHOOL";
  const [level, setLevel] = useState<Level>(initialLevel);
  const [sourceId, setSourceId] = useState(source?.id ?? "");

  function openDialog() {
    setLevel(initialLevel);
    setSourceId(source?.id ?? "");
    setOpen(true);
  }

  const duplicate = mode === "duplicate";
  return (
    <>
      {duplicate ? (
        <Button variant="secondary" size="sm" onClick={openDialog} disabled={!levels.length}>
          <Copy aria-hidden /> Dupliquer
        </Button>
      ) : (
        <Button onClick={openDialog} disabled={!levels.length}>
          <Plus aria-hidden /> Nouveau rôle
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={duplicate ? `Dupliquer le rôle ${source?.name ?? ""}` : "Nouveau rôle"}
        description="Vous ne pouvez inclure que des droits que vous détenez, à votre niveau ou en dessous."
      >
        <ActionForm
          action={createRole}
          onSuccess={(state) => {
            const data = state?.data as { id: string } | undefined;
            setOpen(false);
            if (data) router.push(`/espace/droits?role=${data.id}`);
          }}
          className="flex flex-col gap-4"
        >
          <FormField label="Nom du rôle" name="name" required hint="Par exemple : Analyste départemental, Surveillant général.">
            <Input maxLength={60} autoComplete="off" defaultValue={source ? `Copie de ${source.name}`.slice(0, 60) : ""} />
          </FormField>
          <FormField label="Description" name="description" hint="Ce que fait la personne qui détient ce rôle. 300 caractères maximum.">
            <Textarea maxLength={300} rows={3} defaultValue={source?.description ?? ""} />
          </FormField>
          <FormField label="Copier les droits de" name="sourceRoleId" hint="Facultatif. Les droits que vous ne détenez pas ne sont pas copiés.">
            <Select
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                const picked = allowed(roles.find((r) => r.id === e.target.value)?.scopeLevel);
                if (picked) setLevel(picked);
              }}
            >
              <option value="">Aucun, rôle vide</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Niveau d'action" name="scopeLevel" required hint="Le périmètre des comptes qui recevront ce rôle.">
            <Select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {levels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton pendingLabel="Création…">Créer le rôle</SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}

export function EditRoleDialog({ role }: { role: { id: string; name: string; description: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Renommer
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Modifier le rôle ${role.name}`}>
        <ActionForm action={updateRoleDetails} onSuccess={() => setOpen(false)} className="flex flex-col gap-4">
          <input type="hidden" name="roleId" value={role.id} />
          <FormField label="Nom du rôle" name="name" required>
            <Input maxLength={60} autoComplete="off" defaultValue={role.name} />
          </FormField>
          <FormField label="Description" name="description" hint="300 caractères maximum.">
            <Textarea maxLength={300} rows={3} defaultValue={role.description} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}

// Deleting a custom role. When accounts hold it, they move to a role of the
// same level that the viewer could assign; the server checks it again.
export function DeleteRoleDialog({
  role,
  targets,
  blockedReason,
}: {
  role: { id: string; name: string; users: number };
  targets: { id: string; name: string }[];
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const plural = role.users > 1;
  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Supprimer
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Supprimer le rôle ${role.name} ?`}>
        {blockedReason ? (
          <div className="flex flex-col gap-4">
            <Alert tone="warning">{blockedReason}</Alert>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <ActionForm
            action={deleteRole}
            onSuccess={() => {
              setOpen(false);
              router.push("/espace/droits");
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="roleId" value={role.id} />
            {role.users > 0 ? (
              <>
                <p className="text-sm text-muted">
                  {role.users} compte{plural ? "s utilisent" : " utilise"} ce rôle. Choisissez le rôle qui {plural ? "les accueillera" : "l'accueillera"} : le
                  périmètre de chaque compte reste le même, ses droits deviennent ceux du nouveau rôle dès la page suivante.
                </p>
                <FormField label="Nouveau rôle des comptes" name="targetRoleId" required>
                  <Select defaultValue="">
                    <option value="">Choisir un rôle</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </>
            ) : (
              <p className="text-sm text-muted">Aucun compte n&apos;utilise ce rôle. Sa suppression est définitive et sera inscrite au journal.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <SubmitButton variant="danger" pendingLabel="Suppression…">
                {role.users > 0 ? "Déplacer les comptes et supprimer" : "Supprimer le rôle"}
              </SubmitButton>
            </div>
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}

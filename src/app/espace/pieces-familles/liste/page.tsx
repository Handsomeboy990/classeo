import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { InfoTip } from "@/components/kit/info-tip";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { addRequiredPiece, archiveRequiredPiece } from "@/features/family-documents/actions";
import { schoolPieces } from "@/features/family-documents/queries";
import { requirePermission } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Pièces demandées à l'inscription" };

export default async function RequiredPiecesPage() {
  const user = await requirePermission("family_document:approve");
  const { pieces, levels } = await schoolPieces(user);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pièces demandées à l'inscription"
        description="La liste que les parents voient dans « Pièces et justificatifs ». Une pièce vaut pour toutes les classes ou pour un seul niveau."
        actions={
          <>
            <ButtonLink href="/espace/pieces-familles" variant="secondary" className="max-lg:hidden">
              <ArrowLeft aria-hidden /> Pièces des familles
            </ButtonLink>
            <FormDialog
              action={addRequiredPiece}
              trigger={
                <>
                  <Plus aria-hidden /> Ajouter une pièce
                </>
              }
              title="Ajouter une pièce"
              description="Les parents concernés la voient aussitôt dans leur liste."
              submitLabel="Ajouter"
            >
              <FormField label="Nom de la pièce" name="label" required hint="Par exemple : Copie de l'acte de naissance, Deux photos d'identité.">
                <Input maxLength={120} autoComplete="off" />
              </FormField>
              <FormField label="Précision" name="description" hint="Facultative. Par exemple : copie légalisée ou sécurisée.">
                <Input maxLength={300} autoComplete="off" />
              </FormField>
              <FormField label="Pour quelles classes" name="levelId">
                <Select defaultValue="">
                  <option value="">Toutes les classes</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} seulement
                    </option>
                  ))}
                </Select>
              </FormField>
              <Checkbox
                name="isHealth"
                value="on"
                label="Pièce de santé"
                description="Carnet de vaccination, livret de santé : seul le chef d'établissement l'ouvre, et le fichier est supprimé après vérification."
              />
            </FormDialog>
          </>
        }
      />
      <Card>
        {pieces.length === 0 ? (
          <EmptyState title="Aucune pièce demandée" description="Ajoutez les pièces du dossier d'inscription : acte de naissance, photos, bulletins de l'an dernier…" />
        ) : (
          <ul className="divide-y divide-border">
            {pieces.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {p.label}
                    <Badge tone="neutral">{p.level ? p.level.name : "Toutes les classes"}</Badge>
                    {p.isHealth && (
                      <>
                        <Badge tone="info">Pièce de santé</Badge>
                        <InfoTip label={`À propos de la pièce de santé ${p.label}`}>Seul le chef d&apos;établissement l&apos;ouvre. Le fichier est supprimé dès la décision.</InfoTip>
                      </>
                    )}
                  </p>
                  {p.description && <p className="text-sm text-muted">{p.description}</p>}
                  <p className="text-xs text-muted">
                    {p._count.documents} envoi{p._count.documents > 1 ? "s" : ""} reçu{p._count.documents > 1 ? "s" : ""}
                  </p>
                </div>
                <ConfirmButton
                  action={archiveRequiredPiece}
                  fields={{ pieceId: p.id }}
                  variant="danger-ghost"
                  size="sm"
                  title="Retirer cette pièce de la liste ?"
                  description={`« ${p.label} » ne sera plus demandée aux familles. Les pièces déjà reçues restent consultables.`}
                  confirmLabel="Retirer"
                >
                  <Trash2 aria-hidden /> Retirer
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

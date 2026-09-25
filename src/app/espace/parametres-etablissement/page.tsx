import { Landmark, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/kit/action-form";
import { ConfirmButton } from "@/components/kit/confirm-button";
import { FormDialog } from "@/components/kit/form-dialog";
import { FormField } from "@/components/kit/form-field";
import { ImageUpload } from "@/components/kit/image-upload";
import { PageHeader } from "@/components/kit/page-header";
import { EmptyState } from "@/components/kit/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";
import { SchoolStatusBanner } from "@/features/school-status/components/status-banner";
import { deletePaymentAccount, savePaymentAccount, updateSchoolProfile } from "@/features/school-settings/actions";
import { AccountFields } from "@/features/school-settings/components/account-fields";
import { getOwnSchoolSettings } from "@/features/school-settings/queries";
import { CHANNEL_LABELS, groupByFour, MAX_PAYMENT_ACCOUNTS } from "@/features/school-settings/rules";
import { requirePermission } from "@/lib/auth/authorize";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Paramètres de l'établissement" };

export default async function SchoolSettingsPage() {
  const user = await requirePermission("school:update");
  const school = await getOwnSchoolSettings(user);
  // Territory agents edit schools from the Établissements pages.
  if (!school) forbidden();
  const logo = fileUrl(school.logoFileId);
  const locked = school.status !== "ACTIVE";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Paramètres de l'établissement" description={`Identité de ${school.name} (${school.code}) et comptes où les parents paient les frais.`} />
      <SchoolStatusBanner user={user} />

      <Card aria-labelledby="identity-title">
        <CardHeader>
          <div>
            <CardTitle id="identity-title">Identité</CardTitle>
            <CardDescription>Le logo et le nom apparaissent en haut de l&apos;écran de votre personnel et sur vos documents.</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <ActionForm action={updateSchoolProfile} className="flex flex-col gap-4">
            <ImageUpload name="logo" label="Logo" currentUrl={logo} maxSide={512} keepAlpha accept="image/png,image/jpeg,image/webp,image/svg+xml" hint="PNG, JPEG, WebP ou SVG. L'image est réduite avant l'envoi." />
            {logo && <Checkbox name="removeLogo" label="Retirer le logo actuel" />}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nom officiel" name="name" required className="sm:col-span-2">
                <Input defaultValue={school.name} maxLength={150} />
              </FormField>
              <FormField label="Devise" name="motto" hint="Par exemple : Travail, Discipline, Réussite." className="sm:col-span-2">
                <Input defaultValue={school.motto ?? ""} maxLength={120} />
              </FormField>
              <FormField label="Adresse" name="address" className="sm:col-span-2">
                <Input defaultValue={school.address ?? ""} maxLength={200} />
              </FormField>
              <FormField label="Téléphone" name="phone" hint="Exemple : 01 97 12 34 56">
                <Input type="tel" inputMode="tel" defaultValue={school.phone ?? ""} />
              </FormField>
              <FormField label="Adresse e-mail" name="email">
                <Input type="email" defaultValue={school.email ?? ""} />
              </FormField>
              <FormField label="Boîte postale" name="postalBox" hint="Exemple : 01 BP 1234 Cotonou">
                <Input defaultValue={school.postalBox ?? ""} maxLength={60} />
              </FormField>
              <FormField label="Site web" name="website" hint="Exemple : www.mon-ecole.bj">
                <Input defaultValue={school.website ?? ""} maxLength={200} inputMode="url" />
              </FormField>
            </div>
            <div className="flex justify-end">
              <SubmitButton disabled={locked}>Enregistrer l&apos;identité</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      <Card aria-labelledby="accounts-title">
        <CardHeader>
          <div>
            <CardTitle id="accounts-title">Comptes de paiement</CardTitle>
            <CardDescription>Mobile Money (MTN MoMo, Moov Money, Celtiis Cash) et comptes bancaires proposés aux parents pour payer les frais.</CardDescription>
          </div>
          {!locked && school.paymentAccounts.length < MAX_PAYMENT_ACCOUNTS && (
            <FormDialog action={savePaymentAccount} trigger={<><Plus aria-hidden /> Ajouter un compte</>} triggerSize="sm" title="Nouveau compte de paiement" submitLabel="Ajouter le compte">
              <AccountFields />
            </FormDialog>
          )}
        </CardHeader>
        <CardBody>
          {school.paymentAccounts.length === 0 ? (
            <EmptyState title="Aucun compte de paiement" description="Sans compte, le paiement en ligne n'est pas proposé aux parents." />
          ) : (
            <ul className="flex flex-col gap-3">
              {school.paymentAccounts.map((a) => {
                const Icon = a.channel === "MOBILE_MONEY" ? Smartphone : Landmark;
                return (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-control border border-border p-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary" aria-hidden>
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {a.provider}
                          <span className="text-sm font-normal text-muted">{CHANNEL_LABELS[a.channel]}</span>
                          {a.isActive ? <Badge tone="success">Proposé aux parents</Badge> : <Badge>Inactif</Badge>}
                        </p>
                        <p className="font-mono text-sm break-all">{a.channel === "BANK" ? groupByFour(a.accountNumber) : a.accountNumber}</p>
                        <p className="text-sm text-muted">Titulaire : {a.accountName}</p>
                        {a.instructions && <p className="mt-1 text-sm">{a.instructions}</p>}
                      </div>
                    </div>
                    {!locked && (
                      <div className="flex gap-2">
                        <FormDialog
                          action={savePaymentAccount}
                          trigger={<Pencil aria-hidden />}
                          triggerVariant="ghost"
                          triggerSize="icon-sm"
                          triggerLabel={`Modifier le compte ${a.provider}`}
                          title={`Modifier le compte ${a.provider}`}
                        >
                          <AccountFields values={a} />
                        </FormDialog>
                        <ConfirmButton
                          action={deletePaymentAccount}
                          fields={{ id: a.id }}
                          variant="danger-ghost"
                          size="icon-sm"
                          label={`Supprimer le compte ${a.provider}`}
                          title={`Supprimer le compte ${a.provider} ?`}
                          description="Les parents ne le verront plus. Un compte ayant déjà reçu des paiements est seulement désactivé."
                          confirmLabel="Supprimer"
                        >
                          <Trash2 aria-hidden />
                        </ConfirmButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

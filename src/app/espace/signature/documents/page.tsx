import { BadgeCheck, FileText, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { SearchInput } from "@/components/kit/search-input";
import { EmptyState } from "@/components/kit/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignButton, SignClassButton } from "@/features/signatures/components/image-forms";
import { SignatureNav } from "@/features/signatures/components/signature-nav";
import { requireSchoolSigner, signatureTabs } from "@/features/signatures/nav";
import { mySignature, pupilsToSign, reportCardBatches } from "@/features/signatures/queries";
import { param } from "@/lib/list";
import { PdfDownloadLink } from "@/lib/pdf/download-link";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents à signer" };

function Signed({ code, at }: { code: string; at: Date }) {
  return (
    <Badge tone="success">
      <BadgeCheck aria-hidden /> Signé le {formatDate(at)} ·{" "}
      <Link href={`/verifier/${code}`} className="underline underline-offset-2">
        {code}
      </Link>
    </Badge>
  );
}

export default async function DocumentsToSignPage({ searchParams }: PageProps<"/espace/signature/documents">) {
  const user = await requireSchoolSigner();
  const q = (param(await searchParams, "q") ?? "").trim().slice(0, 60);
  const [mine, pupils, batches] = await Promise.all([mySignature(user), pupilsToSign(user, q), reportCardBatches(user)]);
  const ready = !!mine.signatureUrl;

  return (
    <>
      <PageHeader title="Documents à signer" description={user.scope.label} info="Attestations, certificats de scolarité et bulletins en attente de votre signature." />
      <SignatureNav items={signatureTabs(user)} />

      {!ready && (
        <Alert tone="warning" title="Enregistrez d'abord votre signature" className="mb-6" action={<ButtonLink href="/espace/signature" size="sm">Ma signature</ButtonLink>}>
          Les boutons de signature s&apos;activent dès que votre signature est enregistrée.
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bulletins publiés</CardTitle>
              <CardDescription>Par classe et par période. Un bulletin corrigé après signature doit être signé à nouveau.</CardDescription>
            </div>
          </CardHeader>
          {batches.length === 0 ? (
            <EmptyState icon={<FileText className="size-7" />} title="Aucun bulletin publié cette année" description="Les bulletins apparaissent ici dès leur publication." />
          ) : (
            <ul className="divide-y divide-border">
              {batches.map((b) => {
                const remaining = b.total - b.signed;
                return (
                  <li key={`${b.classroomId}:${b.periodId}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {b.classroom} · {b.period}
                      </p>
                      <p className="text-sm text-muted">
                        {b.signed} signé{b.signed > 1 ? "s" : ""} sur {b.total}
                      </p>
                    </div>
                    {remaining === 0 ? (
                      <Badge tone="success">
                        <BadgeCheck aria-hidden /> Tous signés
                      </Badge>
                    ) : ready ? (
                      <SignClassButton classroomId={b.classroomId} periodId={b.periodId} classroom={b.classroom} period={b.period} remaining={remaining} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Attestations et certificats de scolarité</CardTitle>
              <CardDescription>Élèves inscrits cette année. L&apos;attestation couvre l&apos;année en cours, le certificat toute la scolarité dans l&apos;établissement.</CardDescription>
            </div>
            <div className="w-full sm:w-72">
              <SearchInput placeholder="Nom ou matricule…" />
            </div>
          </CardHeader>
          {pupils.length === 0 ? (
            <EmptyState variant={q ? "no-results" : "empty"} icon={<GraduationCap className="size-7" />} title={q ? "Aucun élève ne correspond" : "Aucun élève inscrit cette année"} />
          ) : (
            <ul className="divide-y divide-border">
              {pupils.map((p) => {
                const who = `${p.student.lastName} ${p.student.firstName}`;
                return (
                  <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{who}</p>
                      <p className="text-sm text-muted">
                        {p.classroom.name} · matricule {p.student.matricule}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[34rem]">
                      {(["attestation", "certificat"] as const).map((kind) => {
                        const state = p[kind];
                        const label = kind === "attestation" ? "Attestation" : "Certificat";
                        const path = kind === "attestation" ? "attestation" : "certificat";
                        return (
                          <div key={kind} className="flex flex-col items-start gap-1.5 rounded-control border border-border px-3 py-2">
                            <p className="text-sm font-semibold">{label}</p>
                            {state ? <Signed code={state.code} at={state.at} /> : <span className="text-xs text-muted">Non signé</span>}
                            <div className="flex flex-wrap gap-1.5">
                              {!state && ready && (
                                <SignButton
                                  kind={kind}
                                  subjectId={p.id}
                                  label={`Signer ${kind === "attestation" ? "l'attestation" : "le certificat"}`}
                                  description={`${kind === "attestation" ? "L'attestation de scolarité" : "Le certificat de scolarité"} de ${who} recevra votre signature et votre cachet, avec un code de vérification. La famille est prévenue.`}
                                />
                              )}
                              <PdfDownloadLink href={`/api/pdf/${path}/${p.student.id}`} label="PDF" size="sm" variant="ghost" description={`${label.toLowerCase()} de ${who}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

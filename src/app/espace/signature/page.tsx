import { FileSignature, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGNER_LABELS, signerKind } from "@/features/signatures/access";
import { SignatureImageForm } from "@/features/signatures/components/image-forms";
import { SignaturePad } from "@/features/signatures/components/signature-pad";
import { SignatureNav } from "@/features/signatures/components/signature-nav";
import { requireSigner, signatureTabs } from "@/features/signatures/nav";
import { mySignature } from "@/features/signatures/queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Signature électronique" };

export default async function SignaturePage() {
  const user = await requireSigner();
  const kind = signerKind(user)!;
  const mine = await mySignature(user);

  return (
    <>
      <PageHeader
        title="Signature électronique"
        description={`${user.fullName} · ${SIGNER_LABELS[kind]} · ${user.scope.label}`}
        actions={
          kind === "school" ? (
            <ButtonLink href="/espace/signature/documents">
              <FileSignature aria-hidden /> Documents à signer
            </ButtonLink>
          ) : null
        }
      />
      <SignatureNav items={signatureTabs(user)} />

      <div className="flex flex-col gap-6">
        {!mine.signatureUrl ? (
          <Alert tone="warning" title="Aucune signature enregistrée">
            Tracez votre signature ci-dessous ou importez-en une image. {kind === "school" ? "Sans signature, les documents de l'établissement restent imprimés avec un cadre à signer à la main." : ""}
          </Alert>
        ) : (
          <Alert tone="success" title="Signature prête">
            Enregistrée{mine.updatedAt ? ` le ${formatDate(mine.updatedAt)}` : ""}.{" "}
            {kind === "school" ? "Elle s'applique aux attestations, certificats et bulletins que vous signez." : "Elle s'applique aux documents que votre niveau délivre."}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 *:min-w-0 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tracer ma signature</CardTitle>
                <CardDescription>Sur un téléphone, une tablette ou avec la souris.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <SignaturePad />
            </CardBody>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Ou importer une image</CardTitle>
                  <CardDescription>Une signature scannée, détourée sur fond transparent.</CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                <SignatureImageForm purpose="signature" currentUrl={mine.signatureUrl} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Cachet</CardTitle>
                  <CardDescription>Le cachet de votre fonction, apposé à côté de la signature.</CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                <SignatureImageForm purpose="stamp" currentUrl={mine.stampUrl} />
              </CardBody>
            </Card>
          </div>
        </div>

        <Card>
          <CardBody className="flex gap-3 text-sm text-muted">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p>
              Vos images ne sont visibles que par vous et ne sont jamais publiées. Chaque document signé reçoit un code et un QR code : n&apos;importe qui peut vérifier en
              ligne qu&apos;il est authentique et qu&apos;il n&apos;a pas été modifié depuis votre signature. L&apos;impression reste facultative.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

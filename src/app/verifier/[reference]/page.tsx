import { Ban, BadgeCheck, CircleHelp, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";

import { Card, CardBody } from "@/components/ui/card";
import { FileCheck } from "@/features/verification/components/file-check";
import { CodeSearch, PublicShell } from "@/features/verification/components/public-shell";
import { RevokeButton } from "@/features/verification/components/revoke-form";
import { canRevoke, publicVerification } from "@/features/verification/queries";
import { normalizeCode } from "@/features/verification/reference";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { hitRateLimit } from "@/lib/rate-limit";
import { NO_INDEX } from "@/lib/seo";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Vérification d'un document", robots: NO_INDEX };

const STATUS = {
  valid: { Icon: BadgeCheck, title: "Document authentique", tone: "border-success/30 bg-success-soft text-success", text: "Ce document a bien été délivré sur Classéo et il est valable." },
  revoked: { Icon: Ban, title: "Document révoqué", tone: "border-danger/30 bg-danger-soft text-danger", text: "Ce document a été délivré sur Classéo, puis révoqué : il n'est plus valable." },
  unknown: { Icon: CircleHelp, title: "Code inconnu", tone: "border-warning/30 bg-warning-soft text-warning", text: "Aucun document délivré sur Classéo ne porte ce code. Vérifiez la saisie ; si le code est exact, le document n'est pas authentique." },
} as const;

// Public: whoever holds a paper (an employer, another school, an embassy)
// checks it without an account. Minimal details only: the kind, the
// school, the initials of the pupil, the signer and the dates.
export default async function VerifyPage({ params }: PageProps<"/verifier/[reference]">) {
  const { reference } = await params;
  const code = normalizeCode(decodeURIComponent(reference));

  const limit = await hitRateLimit(`verify:${clientIp(await headers())}`, 300, 10 * 60 * 1000);
  if (!limit.allowed) {
    return (
      <PublicShell>
        <h1 className="text-2xl font-bold">Trop de vérifications</h1>
        <p className="mt-2 text-muted">Beaucoup de vérifications ont été faites depuis cette connexion. Réessayez dans quelques minutes.</p>
      </PublicShell>
    );
  }

  const result = code ? await publicVerification(code) : ({ status: "unknown" } as const);
  const s = STATUS[result.status];
  const user = await getCurrentUser();
  const revocable = result.status === "valid" && (await canRevoke(user, { kind: result.kind, schoolId: result.schoolId }));

  return (
    <PublicShell>
      <p className="text-sm font-semibold text-muted">Vérification d&apos;un document</p>
      <h1 className="mt-1 font-mono text-2xl font-bold tracking-wider sm:text-3xl">{code ?? decodeURIComponent(reference).slice(0, 20)}</h1>

      <div role="status" className={cn("mt-5 flex items-start gap-3 rounded-card border px-4 py-4", s.tone)}>
        <s.Icon className="mt-0.5 size-7 shrink-0" aria-hidden />
        <div>
          <p className="text-lg font-bold">{s.title}</p>
          <p className="text-sm text-text">{s.text}</p>
          {result.status === "revoked" && result.revokedAt && (
            <p className="mt-1 text-sm text-text">
              Révoqué le {formatDate(result.revokedAt)}
              {result.revokedReason ? `. Motif : ${result.revokedReason}` : "."}
            </p>
          )}
        </div>
      </div>

      {result.status !== "unknown" && (
        <Card className="mt-5">
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Document" value={result.kindLabel} />
              <Item label="Délivré le" value={formatDate(result.issuedAt)} />
              {result.school && <Item label="Établissement" value={result.school} />}
              {result.pupil && <Item label="Élève (initiales)" value={result.pupil} />}
            </dl>
            {result.signed && (
              <p className="mt-4 flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2 text-sm">
                <PenLine className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Signé électroniquement par <strong>{result.signed.by}</strong>, {result.signed.role}, le {formatDate(result.signed.at)}. La signature scelle le contenu du
                  document : toute modification ultérieure (une note, un nom) la rend caduque.
                </span>
              </p>
            )}
            {result.fileHash && result.status === "valid" && (
              <div className="mt-5 border-t border-border pt-4">
                <FileCheck expected={result.fileHash} />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {revocable && result.status === "valid" && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <p className="text-sm text-muted">Vous gérez ce document dans votre établissement.</p>
          <RevokeButton id={result.id} code={result.code} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-2 text-base font-bold">Vérifier un autre document</h2>
        <CodeSearch />
      </div>
      <p className="mt-6 text-xs text-muted">Pour protéger les élèves, cette page n&apos;affiche ni nom complet, ni note, ni montant.</p>
    </PublicShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold break-words">{value}</dd>
    </div>
  );
}

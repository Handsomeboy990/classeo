import { Ban, BadgeCheck, FileStack, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/kit/page-header";
import { SearchInput } from "@/components/kit/search-input";
import { EmptyState } from "@/components/kit/states";
import { UrlSelect } from "@/components/kit/url-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { SignatureNav } from "@/features/signatures/components/signature-nav";
import { requireRegister, signatureTabs } from "@/features/signatures/nav";
import { RevokeButton } from "@/features/verification/components/revoke-form";
import { canRevoke, listIssued } from "@/features/verification/queries";
import { DOCUMENT_KINDS, type DocumentKind } from "@/features/verification/reference";
import { param } from "@/lib/list";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents délivrés" };

export default async function RegisterPage({ searchParams }: PageProps<"/espace/signature/registre">) {
  const user = await requireRegister();
  const sp = await searchParams;
  const q = (param(sp, "q") ?? "").trim().slice(0, 20);
  const kind = param(sp, "type");
  const { rows, total } = await listIssued(user, { q, kind, take: 60 });
  const revocable = await Promise.all(rows.map((r) => (r.revokedAt ? false : canRevoke(user, r))));

  return (
    <>
      <PageHeader title="Documents délivrés" description={user.scope.label} info="Registre des documents générés, avec leur code de vérification." />
      <SignatureNav items={signatureTabs(user)} />
      <Card>
        <CardHeader>
          <p className="text-sm text-muted">
            {formatNumber(total)} document{total > 1 ? "s" : ""}
            {rows.length < total ? `, les ${rows.length} plus récents affichés` : ""}
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <UrlSelect param="type" label="Type de document" hideLabel allLabel="Tous les types" options={Object.entries(DOCUMENT_KINDS).map(([value, label]) => ({ value, label }))} />
            <SearchInput placeholder="Code de vérification…" />
          </div>
        </CardHeader>
        {rows.length === 0 ? (
          <EmptyState
            variant={q || kind ? "no-results" : "empty"}
            icon={<FileStack className="size-7" />}
            title={q || kind ? "Aucun document ne correspond" : "Aucun document délivré"}
            description={q || kind ? undefined : "Chaque PDF téléchargé et chaque document imprimé depuis Classéo est inscrit ici avec son code."}
          />
        ) : (
          <Table>
            <caption className="sr-only">Documents délivrés, du plus récent au plus ancien</caption>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Document</TH>
                <TH className="max-sm:hidden">Délivré</TH>
                <TH>État</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r, i) => (
                <TR key={r.id}>
                  <TD className="font-mono text-sm font-semibold whitespace-nowrap">
                    <Link href={`/verifier/${r.reference}`} className="text-primary underline-offset-2 hover:underline">
                      {r.reference}
                    </Link>
                  </TD>
                  <TD>
                    <span className="block">{DOCUMENT_KINDS[r.kind as DocumentKind] ?? r.title}</span>
                    <span className="block text-xs text-muted sm:hidden">{formatDate(r.createdAt)}</span>
                  </TD>
                  <TD className="max-sm:hidden">
                    <span className="block">{formatDate(r.createdAt)}</span>
                    <span className="block text-xs text-muted">{r.issuedBy}</span>
                  </TD>
                  <TD>
                    {r.revokedAt ? (
                      <Badge tone="danger">
                        <Ban aria-hidden /> Révoqué
                      </Badge>
                    ) : r.signatureId ? (
                      <Badge tone="success">
                        <PenLine aria-hidden /> Signé
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <BadgeCheck aria-hidden /> Valable
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-right">{revocable[i] && <RevokeButton id={r.id} code={r.reference} size="sm" />}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

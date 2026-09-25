import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

import { beninDate, beninDateTime } from "../format";
import type { DocumentMeta, Issuer } from "../layout";

// HTML twin of the PDF layout, for the pages printed from the browser: the
// same flag band, header, typography and footer, on white paper. The styles
// are local to the sheet (class names prefixed with doc-) so the application
// theme never leaks onto paper, and table rows never break across pages.
const CSS = `
.doc-sheet { --doc-green: #006b40; --doc-dark: #0b3b2a; --doc-soft: #e3f1e9; --doc-muted: #545a52; --doc-border: #cfcec4; --doc-rule: #dddcd3; --doc-zebra: #f6f6f1;
  background: #fff; color: #1a1d1a; font-family: var(--font-body), system-ui, sans-serif; font-size: 13px; line-height: 1.4; position: relative; }
.doc-sheet .doc-band { display: flex; height: 5px; }
.doc-sheet .doc-band span:nth-child(1) { flex: 5; background: #006b40; }
.doc-sheet .doc-band span:nth-child(2) { flex: 2; background: #fcd116; }
.doc-sheet .doc-band span:nth-child(3) { flex: 2; background: #e8112d; }
.doc-sheet .doc-title { font-family: var(--font-display), system-ui, sans-serif; font-weight: 700; color: var(--doc-dark); line-height: 1.1; }
.doc-sheet .doc-label { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--doc-muted); }
.doc-sheet .doc-muted { color: var(--doc-muted); }
.doc-sheet .doc-box { border: 1px solid var(--doc-border); border-radius: 6px; }
.doc-sheet table.doc-table { width: 100%; border-collapse: collapse; border-top: 1.5px solid var(--doc-green); border-bottom: 1px solid var(--doc-border); }
.doc-sheet .doc-table thead th { background: var(--doc-soft); color: var(--doc-dark); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; text-align: left; padding: 7px 8px; border-bottom: 1.5px solid var(--doc-green); }
.doc-sheet .doc-table td, .doc-sheet .doc-table tbody th { padding: 6px 8px; border-bottom: 1px solid var(--doc-rule); text-align: left; font-weight: 400; vertical-align: middle; }
.doc-sheet .doc-table tbody tr:nth-child(even) { background: var(--doc-zebra); }
.doc-sheet .doc-table tfoot td, .doc-sheet .doc-table tfoot th { background: #f0f1ea; border-top: 1.5px solid var(--doc-green); font-weight: 700; padding: 6px 8px; text-align: left; }
.doc-sheet .doc-num { text-align: right !important; font-variant-numeric: tabular-nums; }
.doc-sheet .doc-center { text-align: center !important; }
.doc-sheet .doc-figure { border: 1px solid var(--doc-border); border-radius: 6px; padding: 10px 12px; }
.doc-sheet .doc-figure.doc-primary { background: var(--doc-soft); border-color: var(--doc-green); }
.doc-sheet .doc-figure strong { display: block; font-family: var(--font-display), system-ui, sans-serif; font-size: 24px; color: var(--doc-dark); line-height: 1.2; margin-top: 2px; }
.doc-sheet .doc-sign { height: 64px; border: 1px dashed var(--doc-border); border-radius: 6px; margin-top: 6px; display: flex; align-items: flex-end; padding: 4px 6px; font-size: 9px; color: #7a8078; }
.doc-sheet .doc-notice { background: #fff1d1; border-left: 3px solid #8a5a00; padding: 6px 10px; }
@media print {
  @page { size: A4; margin: 12mm 12mm 14mm; }
  /* Only the sheet reaches the paper: every element that neither holds it
     nor sits inside it is left out (menus, toolbars, notices). */
  body:has(.doc-sheet) *:not(:has(.doc-sheet)):not(.doc-sheet):not(.doc-sheet *) { display: none !important; }
  .doc-sheet { font-size: 11px; border: 0 !important; box-shadow: none !important; padding: 0 !important; max-width: none !important; }
  .doc-sheet .doc-table tr, .doc-sheet .doc-keep { break-inside: avoid; page-break-inside: avoid; }
  .doc-sheet .doc-table thead { display: table-header-group; }
  .doc-sheet .doc-table tfoot { display: table-row-group; }
  .doc-sheet .doc-no-print { display: none !important; }
  .doc-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

function IssuerBlock({ issuer }: { issuer: Issuer }) {
  const contact = issuer.kind === "school" ? [issuer.phone ? `Tél. ${issuer.phone}` : null, issuer.email].filter(Boolean).join(" · ") : "";
  return (
    <div className="min-w-0">
      <p className="doc-label">République du Bénin</p>
      {issuer.kind === "ministry" ? (
        <>
          <p className="mt-0.5 font-bold">Ministère des Enseignements</p>
          <p>{issuer.name}</p>
        </>
      ) : (
        <>
          <p className="mt-0.5 font-bold">{issuer.name}</p>
          {(issuer.address || issuer.place) && <p className="doc-muted text-xs">{[issuer.address, issuer.place].filter(Boolean).join(", ")}</p>}
          {contact && <p className="doc-muted text-xs">{contact}</p>}
        </>
      )}
    </div>
  );
}

export function PrintSheet({
  meta,
  landscape = false,
  className,
  headerExtra,
  children,
  id,
}: {
  meta: DocumentMeta;
  landscape?: boolean;
  className?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const by = meta.generatedBy;
  return (
    <article
      id={id}
      data-print-root
      aria-label={`${meta.title}${meta.subtitle ? `, ${meta.subtitle}` : ""}`}
      className={cn("doc-sheet mx-auto overflow-hidden rounded-card border border-border shadow-sm", landscape ? "max-w-6xl" : "max-w-4xl", className)}
    >
      <style>{CSS}</style>
      {landscape && <style>{`@media print { @page { size: A4 landscape; } }`}</style>}
      <div className="doc-band" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="p-5 sm:p-8 print:p-0 print:pt-3">
        <header className="flex flex-col gap-4 border-b-2 border-[#006b40] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <LogoMark className="size-11" />
              <span className="doc-title text-[11px]">Classéo</span>
            </div>
            <IssuerBlock issuer={meta.issuer} />
          </div>
          <div className="sm:text-right">
            <h1 className="doc-title text-2xl sm:text-[26px]">{meta.title}</h1>
            {meta.subtitle && <p className="mt-1 font-semibold">{meta.subtitle}</p>}
            <p className="mt-1.5 text-xs">
              <span className="doc-label">Réf.</span> <span className="font-bold tracking-wide">{meta.reference}</span>
            </p>
            <p className="doc-muted text-xs">Édité le {beninDate(meta.generatedAt)}</p>
          </div>
        </header>
        {headerExtra}
        <div className="mt-4">{children}</div>
        <footer className="doc-muted mt-8 border-t border-[#cfcec4] pt-2 text-[10px] leading-snug">
          <p>
            Généré sur Classéo le {beninDateTime(meta.generatedAt)} (heure du Bénin) par {by.name}, {by.role}.
          </p>
          <p>
            Vérification : réf. {meta.reference} · compte {by.email}. Le document téléchargé en PDF porte la même référence et figure au journal d&apos;activité.
          </p>
        </footer>
      </div>
    </article>
  );
}

// Label and value grid, the HTML twin of InfoGrid.
export function PrintInfoGrid({ items, columns = 4 }: { items: { label: string; value: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 4 ? "sm:grid-cols-4" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl className={cn("doc-box doc-keep grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3", cols)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="doc-label">{it.label}</dt>
          <dd className="font-semibold break-words">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PrintSignatures({ items, className = "mt-6" }: { items: { role: string; name?: string | null; stamp?: boolean }[]; className?: string }) {
  return (
    <div className={cn("doc-keep grid gap-4", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.role}>
          <p className="doc-label">{s.role}</p>
          <p className="min-h-5 font-semibold">{s.name ?? ""}</p>
          <div className="doc-sign" aria-hidden>
            {s.stamp ? "Signature et cachet" : "Signature"}
          </div>
        </div>
      ))}
    </div>
  );
}

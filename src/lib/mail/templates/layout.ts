// Shared frame of every Classéo e-mail: an HTML version built with tables and
// inline styles (what mail clients reliably render), and a plain text version
// built from the same blocks. Every value is escaped here, so templates pass
// raw strings.
//
// Design source of truth, part 4.15, with the official palette: a navy band
// with the brand reading of the site ("République du Bénin" over "Classéo,
// plateforme de gestion scolaire"), the tricolour rule, a white body, and a
// navy footer carrying the full independence notice. Classéo is named as a
// product, never as an institution.

import { INDEPENDENCE_NOTICE } from "@/components/brand/settings";

// The e-mail palette, the light tokens of the design system.
export const BRAND = {
  navy: "#0A3764",
  navyDark: "#072747",
  navySoft: "#E8EEF6",
  green: "#008751",
  yellow: "#FCD116",
  yellowSoft: "#FFF6CC",
  red: "#E8112D",
  text: "#0F1B2D",
  muted: "#475569",
  border: "#DCE3EC",
  page: "#F4F6FA",
  white: "#FFFFFF",
  headerMuted: "#C9D3E0",
  footerText: "#E8EEF6",
  footerMuted: "#A9B8CC",
  link: "#1B5FB0",
  // Dark mode (clients that honour prefers-color-scheme).
  darkPage: "#0B1422",
  darkSurface: "#121D2E",
  darkSoft: "#16294A",
  darkBorder: "#25344A",
  darkText: "#E6ECF4",
  darkMuted: "#9FB0C6",
  darkLink: "#8DB8FF",
} as const;

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "facts"; rows: [label: string, value: string][] }
  | { type: "code"; label: string; value: string; hint?: string }
  | { type: "button"; label: string; href: string }
  | { type: "notice"; tone: "warning" | "info"; title: string; text: string }
  | { type: "small"; text: string };

export type EmailContent = {
  subject: string;
  // Line shown by mail clients next to the subject, before opening.
  preheader: string;
  eyebrow: string;
  title: string;
  blocks: Block[];
};

export type RenderedEmail = { subject: string; html: string; text: string };

// Montserrat for titles when the reader has it, Arial otherwise (most mail
// clients): accepted by the design source of truth.
const TITLE_FONT = "Montserrat, Arial, sans-serif";
const FONT = "Arial, Helvetica, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

// The brand lines of the header and of the plain text version.
const REPUBLIC = "République du Bénin";
const PRODUCT = "Classéo, plateforme de gestion scolaire";
const AUTOMATIC = "Ce message est envoyé automatiquement par Classéo, plateforme de gestion scolaire : merci de ne pas y répondre.";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Only web links are rendered: a template can never produce a javascript: or
// data: address, whatever it was given.
function safeHref(href: string): string {
  return /^https?:\/\//i.test(href) ? href : "#";
}

function blockHtml(block: Block): string {
  switch (block.type) {
    case "paragraph":
      return `<p class="t-text" style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.text};">${escapeHtml(block.text)}</p>`;
    case "small":
      return `<p class="t-muted" style="margin:0 0 12px;font-size:13px;line-height:1.55;color:${BRAND.muted};">${escapeHtml(block.text)}</p>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="b-border" style="margin:4px 0 20px;border:1px solid ${BRAND.border};border-radius:6px;border-collapse:separate;">
${block.rows
  .map(
    ([label, value], i) => `<tr>
<td class="fact-label t-muted b-border" style="padding:12px 16px;${i ? `border-top:1px solid ${BRAND.border};` : ""}font-size:13px;color:${BRAND.muted};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
<td class="t-text b-border" style="padding:12px 16px;${i ? `border-top:1px solid ${BRAND.border};` : ""}font-size:15px;font-weight:600;color:${BRAND.text};word-break:break-word;">${escapeHtml(value)}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
    case "code":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td class="s-soft" style="padding:18px 16px;background:${BRAND.navySoft};border-radius:6px;text-align:center;">
<p class="t-accent" style="margin:0 0 6px;font-family:${TITLE_FONT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${BRAND.navy};">${escapeHtml(block.label)}</p>
<p class="code t-title" style="margin:0;font-family:${MONO};font-size:28px;line-height:1.3;letter-spacing:0.18em;font-weight:700;color:${BRAND.navyDark};">${escapeHtml(block.value)}</p>
${block.hint ? `<p class="t-muted" style="margin:8px 0 0;font-size:13px;color:${BRAND.muted};">${escapeHtml(block.hint)}</p>` : ""}
</td></tr>
</table>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
<tr><td style="border-radius:6px;background:${BRAND.navy};">
<a href="${escapeHtml(safeHref(block.href))}" style="display:inline-block;padding:13px 26px;font-family:${TITLE_FONT};font-size:16px;font-weight:700;color:${BRAND.white};text-decoration:none;border-radius:6px;border:1px solid ${BRAND.navy};">${escapeHtml(block.label)}</a>
</td></tr>
</table>
<p class="t-muted" style="margin:-12px 0 20px;font-size:12px;line-height:1.5;color:${BRAND.muted};word-break:break-all;">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur : <a class="t-link" href="${escapeHtml(safeHref(block.href))}" style="color:${BRAND.link};text-decoration:underline;">${escapeHtml(block.href)}</a></p>`;
    case "notice": {
      // The flag yellow is a bar only, never a text colour on a light fill.
      const bar = block.tone === "warning" ? BRAND.yellow : BRAND.navy;
      const bg = block.tone === "warning" ? BRAND.yellowSoft : BRAND.navySoft;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td class="${block.tone === "warning" ? "s-warn" : "s-soft"}" style="padding:14px 16px;background:${bg};border-left:4px solid ${bar};border-radius:6px;">
<p class="t-text" style="margin:0 0 4px;font-size:14px;font-weight:700;color:${BRAND.text};">${escapeHtml(block.title)}</p>
<p class="t-text" style="margin:0;font-size:14px;line-height:1.55;color:${BRAND.text};">${escapeHtml(block.text)}</p>
</td></tr>
</table>`;
    }
  }
}

function blockText(block: Block): string {
  switch (block.type) {
    case "paragraph":
    case "small":
      return block.text;
    case "facts":
      return block.rows.map(([label, value]) => `${label} : ${value}`).join("\n");
    case "code":
      return `${block.label} : ${block.value}${block.hint ? `\n${block.hint}` : ""}`;
    case "button":
      return `${block.label} : ${block.href}`;
    case "notice":
      return `${block.title}\n${block.text}`;
  }
}

// Three equal thirds, green, yellow, red: the rule under the header band.
const TRICOLOUR = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
<td width="33%" height="4" style="height:4px;background:${BRAND.green};font-size:0;line-height:0;">&nbsp;</td>
<td width="34%" height="4" style="height:4px;background:${BRAND.yellow};font-size:0;line-height:0;">&nbsp;</td>
<td width="33%" height="4" style="height:4px;background:${BRAND.red};font-size:0;line-height:0;">&nbsp;</td>
</tr></table>`;

// Dark mode: clients that honour prefers-color-scheme (Apple Mail, iOS,
// some webmails) switch the white body to the dark surface; the navy header
// and footer stay as they are. Outlook.com marks its dark mode with
// [data-ogsc] and [data-ogsb].
const STYLE = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (max-width: 620px) {
    .container { width: 100% !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .title { font-size: 22px !important; }
    .code { font-size: 24px !important; letter-spacing: 0.12em !important; }
    .fact-label { width: 42% !important; }
  }
  @media (prefers-color-scheme: dark) {
    .page { background: ${BRAND.darkPage} !important; }
    .body { background: ${BRAND.darkSurface} !important; }
    .t-text, .t-title { color: ${BRAND.darkText} !important; }
    .t-muted { color: ${BRAND.darkMuted} !important; }
    .t-accent, .t-link { color: ${BRAND.darkLink} !important; }
    .s-soft, .s-warn { background: ${BRAND.darkSoft} !important; }
    .b-border { border-color: ${BRAND.darkBorder} !important; }
  }
  [data-ogsc] .t-text, [data-ogsc] .t-title { color: ${BRAND.darkText} !important; }
  [data-ogsc] .t-muted { color: ${BRAND.darkMuted} !important; }
  [data-ogsc] .t-accent, [data-ogsc] .t-link { color: ${BRAND.darkLink} !important; }
  [data-ogsb] .body { background: ${BRAND.darkSurface} !important; }
  [data-ogsb] .s-soft, [data-ogsb] .s-warn { background: ${BRAND.darkSoft} !important; }
`;

export function renderEmail(content: EmailContent): RenderedEmail {
  const html = `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.subject)}</title>
<style>${STYLE}</style>
</head>
<body class="page" style="margin:0;padding:0;background:${BRAND.page};font-family:${FONT};color:${BRAND.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>
<div role="article" aria-roledescription="courriel" aria-label="${escapeHtml(content.subject)}" lang="fr">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="page" style="background:${BRAND.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;border-collapse:separate;border-radius:8px;overflow:hidden;">
<tr><td class="pad" style="padding:20px 36px 18px;background:${BRAND.navy};">
<p style="margin:0 0 6px;font-family:${TITLE_FONT};font-size:10px;line-height:1.2;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;color:${BRAND.headerMuted};">${escapeHtml(REPUBLIC)}</p>
<p style="margin:0;font-family:${TITLE_FONT};font-size:22px;line-height:1.2;letter-spacing:0.02em;font-weight:800;text-transform:uppercase;color:${BRAND.white};">Classéo</p>
<p style="margin:4px 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:${BRAND.headerMuted};">Plateforme de gestion scolaire</p>
</td></tr>
<tr><td style="padding:0;font-size:0;line-height:0;">${TRICOLOUR}</td></tr>
<tr><td class="pad body" style="padding:32px 36px 12px;background:${BRAND.white};border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
<p class="t-accent" style="margin:0 0 8px;font-family:${TITLE_FONT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${BRAND.navy};">${escapeHtml(content.eyebrow)}</p>
<h1 class="title t-title" style="margin:0 0 20px;font-family:${TITLE_FONT};font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.navyDark};">${escapeHtml(content.title)}</h1>
${content.blocks.map(blockHtml).join("\n")}
</td></tr>
<tr><td class="pad" style="padding:20px 36px 22px;background:${BRAND.navyDark};">
<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.5;font-weight:700;color:${BRAND.footerText};">${escapeHtml(INDEPENDENCE_NOTICE.full)}</p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.footerMuted};">${escapeHtml(AUTOMATIC)}</p>
</td></tr>
<tr><td style="padding:0;font-size:0;line-height:0;">${TRICOLOUR}</td></tr>
</table>
</td></tr>
</table>
</div>
</body>
</html>`;

  const text = [
    `${REPUBLIC.toUpperCase()}\n${PRODUCT}`,
    content.title,
    ...content.blocks.map(blockText),
    "--",
    INDEPENDENCE_NOTICE.full,
    AUTOMATIC,
  ].join("\n\n");
  return { subject: content.subject, html, text };
}

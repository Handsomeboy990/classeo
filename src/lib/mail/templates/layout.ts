// Shared frame of every Classéo e-mail: an HTML version built with tables and
// inline styles (what mail clients reliably render), and a plain text version
// built from the same blocks. Every value is escaped here, so templates pass
// raw strings.

export const BRAND = {
  green: "#006B40",
  greenDark: "#0B3B2A",
  greenSoft: "#E3F1E9",
  yellow: "#FCD116",
  yellowSoft: "#FFF6CC",
  red: "#E8112D",
  text: "#1B2420",
  muted: "#5B6B63",
  border: "#DCE3DE",
  page: "#F3F5F1",
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

const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

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
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.text};">${escapeHtml(block.text)}</p>`;
    case "small":
      return `<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:${BRAND.muted};">${escapeHtml(block.text)}</p>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border:1px solid ${BRAND.border};border-radius:10px;border-collapse:separate;">
${block.rows
  .map(
    ([label, value], i) => `<tr>
<td class="fact-label" style="padding:12px 16px;${i ? `border-top:1px solid ${BRAND.border};` : ""}font-size:13px;color:${BRAND.muted};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
<td style="padding:12px 16px;${i ? `border-top:1px solid ${BRAND.border};` : ""}font-size:15px;font-weight:600;color:${BRAND.text};word-break:break-word;">${escapeHtml(value)}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
    case "code":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td style="padding:18px 16px;background:${BRAND.greenSoft};border-radius:10px;text-align:center;">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${BRAND.green};">${escapeHtml(block.label)}</p>
<p class="code" style="margin:0;font-family:${MONO};font-size:28px;line-height:1.3;letter-spacing:0.18em;font-weight:700;color:${BRAND.greenDark};">${escapeHtml(block.value)}</p>
${block.hint ? `<p style="margin:8px 0 0;font-size:13px;color:${BRAND.muted};">${escapeHtml(block.hint)}</p>` : ""}
</td></tr>
</table>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
<tr><td style="border-radius:8px;background:${BRAND.green};">
<a href="${escapeHtml(safeHref(block.href))}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a>
</td></tr>
</table>
<p style="margin:-12px 0 20px;font-size:12px;line-height:1.5;color:${BRAND.muted};word-break:break-all;">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur : <a href="${escapeHtml(safeHref(block.href))}" style="color:${BRAND.green};">${escapeHtml(block.href)}</a></p>`;
    case "notice": {
      const bar = block.tone === "warning" ? BRAND.yellow : BRAND.green;
      const bg = block.tone === "warning" ? BRAND.yellowSoft : BRAND.greenSoft;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
<tr><td style="padding:14px 16px;background:${bg};border-left:4px solid ${bar};border-radius:6px;">
<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${BRAND.text};">${escapeHtml(block.title)}</p>
<p style="margin:0;font-size:14px;line-height:1.55;color:${BRAND.text};">${escapeHtml(block.text)}</p>
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

const FOOTER = "Classéo, plateforme nationale de l'éducation du Bénin. Ce message est envoyé automatiquement : merci de ne pas y répondre.";

export function renderEmail(content: EmailContent): RenderedEmail {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.subject)}</title>
<style>
  @media (max-width: 620px) {
    .container { width: 100% !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .title { font-size: 22px !important; }
    .code { font-size: 24px !important; letter-spacing: 0.12em !important; }
    .fact-label { width: 42% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:${FONT};color:${BRAND.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
<tr><td style="padding:0;font-size:0;line-height:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="40%" style="height:5px;background:${BRAND.green};"></td>
<td width="40%" style="height:5px;background:${BRAND.yellow};"></td>
<td width="20%" style="height:5px;background:${BRAND.red};"></td>
</tr></table>
</td></tr>
<tr><td class="pad" style="padding:22px 36px;background:${BRAND.greenDark};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:34px;height:34px;background:${BRAND.green};border-radius:9px;text-align:center;vertical-align:middle;font-size:18px;font-weight:800;color:${BRAND.yellow};">C</td>
<td style="padding-left:12px;">
<p style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.01em;color:#FFFFFF;">Classéo</p>
<p style="margin:2px 0 0;font-size:12px;color:#A9C2B4;">Plateforme nationale de l'éducation</p>
</td>
</tr></table>
</td></tr>
<tr><td class="pad" style="padding:32px 36px 12px;">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;color:${BRAND.green};">${escapeHtml(content.eyebrow)}</p>
<h1 class="title" style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:800;color:${BRAND.greenDark};">${escapeHtml(content.title)}</h1>
${content.blocks.map(blockHtml).join("\n")}
</td></tr>
<tr><td class="pad" style="padding:18px 36px 26px;border-top:1px solid ${BRAND.border};background:#FAFBF9;">
<p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(FOOTER)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [`CLASSÉO`, content.title, ...content.blocks.map(blockText), "--", FOOTER].join("\n\n");
  return { subject: content.subject, html, text };
}

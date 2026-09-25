// The Classéo mark for generated images (PWA icons, Apple icon, Open Graph).
// Same drawing as src/components/brand/logo.tsx, as a data URI so that
// ImageResponse can render it without a network request.

const MARK = `
  <path d="M20 37a12 12 0 0 1 24 0z" fill="#FCD116"/>
  <g stroke="#FCD116" stroke-width="3" stroke-linecap="round">
    <path d="M32 14v5"/><path d="M17.5 20l3.5 3.5"/><path d="M46.5 20L43 23.5"/>
  </g>
  <path d="M8 38c8-4 16-4 24 2v14c-8-6-16-6-24-2z" fill="#FFFFFF"/>
  <path d="M56 38c-8-4-16-4-24 2v14c8-6 16-6 24-2z" fill="#F0F1EA"/>
  <path d="M30.5 40h3v17l-1.5-2-1.5 2z" fill="#E8112D"/>`;

function uri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Rounded tile, as the favicon.
export const roundedMark = uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#006B40"/>${MARK}</svg>`);

// Full bleed square with the drawing inside the maskable safe zone (the
// central 80 percent), for Android adaptive icons and the Apple icon.
export const squareMark = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#006B40"/><g transform="translate(9.6 7.6) scale(0.7)">${MARK}</g></svg>`,
);

// Just the drawing, transparent background, for compositions.
export const bareMark = uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${MARK}</svg>`);

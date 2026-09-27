// The Classéo mark for generated images (PWA icons, Apple icon, Open Graph),
// on the institutional navy with the flag yellow sun and red bookmark.
// Same drawing as src/components/brand/logo.tsx, as a data URI so that
// ImageResponse can render it without a network request.
//
// The app icon adds the tricolour touch of the official look (owner request
// after decision D5): the mark is lifted 4 units and a green, yellow and red
// rule runs under the book. Its thirds fall on whole pixels at 16, 32 and
// 48 px (x 8, 24, 40, 56; y 56 to 60 of 64), so the favicon stays crisp.
// src/app/icon.svg holds the same drawing.

const MARK = `
  <path d="M20 37a12 12 0 0 1 24 0z" fill="#FCD116"/>
  <g stroke="#FCD116" stroke-width="3" stroke-linecap="round">
    <path d="M32 14v5"/><path d="M17.5 20l3.5 3.5"/><path d="M46.5 20L43 23.5"/>
  </g>
  <path d="M8 38c8-4 16-4 24 2v14c-8-6-16-6-24-2z" fill="#FFFFFF"/>
  <path d="M56 38c-8-4-16-4-24 2v14c8-6 16-6 24-2z" fill="#FFFFFF" fill-opacity="0.86"/>
  <path d="M30.5 40h3v17l-1.5-2-1.5 2z" fill="#E8112D"/>`;

// The mark lifted, over the tricolour rule.
export const APP_MARK = `<g transform="translate(0 -4)">${MARK}</g>
  <rect x="8" y="56" width="16" height="4" fill="#008751"/>
  <rect x="24" y="56" width="16" height="4" fill="#FCD116"/>
  <rect x="40" y="56" width="16" height="4" fill="#E8112D"/>`;

function uri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Rounded tile, as the favicon.
export const roundedMark = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0A3764"/>${APP_MARK}</svg>`,
);

// Full bleed square with the drawing inside the maskable safe zone (the
// central circle of 40 percent radius): scaled to 70 percent and centred on
// the drawing's box (x 8 to 56, y 9.5 to 60), the rule's ends stay 24.4
// units from the centre, inside the 25.6 of the zone. For Android adaptive
// icons and the Apple icon.
export const squareMark = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0A3764"/><g transform="translate(9.6 7.675) scale(0.7)">${APP_MARK}</g></svg>`,
);

// Just the drawing, transparent background, for compositions.
export const bareMark = uri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${MARK}</svg>`,
);

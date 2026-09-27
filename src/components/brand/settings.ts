// Brand settings shared by the server loader (load-brand.ts), the feature
// defaults (lib/features.ts) and the brand components, which also render in
// client components. No server import here.

export type BrandSettings = {
  // Official lockup: coat of arms, institution name, tricolour rule and
  // "République du Bénin" (option brand.official).
  official: boolean;
  // Name of the authority shown in the official lockup, from the option's
  // configuration; empty, the institution line is the name Classéo itself.
  authority: string;
  // Reference of the written decision that authorises the official mode.
  decisionReference: string;
  // Independence notice (option brand.independenceNotice).
  notice: boolean;
};

// Defaults of both options. The owner chose on 2026-09-27 to show the coat
// of arms and to keep the independence notice on every page.
export const BRAND_DEFAULTS: BrandSettings = {
  official: true,
  authority: "",
  decisionReference: "",
  notice: true,
};

// The exact wording of the notice. The full sentence goes on every page;
// the short form is for the documents issued by schools (PDF), where "non
// officielle" could read as casting doubt on a certificate.
export const INDEPENDENCE_NOTICE = {
  full: "Plateforme indépendante, non officielle. Non affiliée au Gouvernement du Bénin.",
  short: "Plateforme indépendante",
} as const;

export type IndependenceNoticeVariant = keyof typeof INDEPENDENCE_NOTICE;

// The coat of arms file (public/brand, credited on /credits) and its
// intrinsic ratio, width over height.
export const ARMS_SRC = "/brand/armoiries-benin.svg";
export const ARMS_RATIO = 474.571 / 419.451;

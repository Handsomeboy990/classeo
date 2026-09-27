import "server-only";

import { BRAND_DEFAULTS } from "@/components/brand/settings";
import { cached } from "@/lib/cache";
import { db } from "@/lib/db";

// Options switchable without a deployment. Every key has its default here;
// a FeatureFlag row (written later from the super administrator back office)
// overrides it. Code reads options only through isEnabled() and featureConfig().

export const FEATURES = {
  "payments.online": { enabled: true, description: "Paiement en ligne des frais par les parents", config: { provider: "fedapay" } },
  "payments.declaration": { enabled: true, description: "Déclaration d'un paiement Mobile Money ou bancaire par le parent", config: {} },
  "languages.translation": { enabled: true, description: "Traduction en langues locales", config: { languages: ["fon", "yo", "bab", "adj", "ee", "ha"] } },
  "languages.voice": { enabled: true, description: "Voix en langues locales", config: { languages: ["fon", "yoruba", "hausa"] } },
  "offline.entry": { enabled: true, description: "Saisie hors connexion et synchronisation", config: {} },
  "exams.mock": { enabled: true, description: "Examens blancs", config: {} },
  "students.transfers": { enabled: true, description: "Transferts d'élèves entre classes et établissements", config: {} },
  "documents.signature": { enabled: true, description: "Signature électronique des documents", config: {} },
  "contents.ticker": { enabled: true, description: "Bandeau défilant des annonces importantes", config: {} },
  // Official lockup (coat of arms, authority, tricolour rule, "République du
  // Bénin"). authority: the institution named in the lockup, empty for
  // Classéo itself; decisionReference: the written authorisation, once it
  // exists. Read through loadBrand() (components/brand/load-brand.ts).
  "brand.official": {
    enabled: BRAND_DEFAULTS.official,
    description: "Bloc-marque officiel : armoiries et mention République du Bénin",
    config: { authority: BRAND_DEFAULTS.authority, decisionReference: BRAND_DEFAULTS.decisionReference },
  },
  "brand.independenceNotice": {
    enabled: BRAND_DEFAULTS.notice,
    description: "Mention « Plateforme indépendante, non officielle » sur chaque page",
    config: {},
  },
} as const satisfies Record<string, { enabled: boolean; description: string; config: Record<string, unknown> }>;

export type FeatureKey = keyof typeof FEATURES;

const overrides = cached(
  async () => {
    const rows = await db.featureFlag.findMany({ select: { key: true, enabled: true, config: true } });
    return Object.fromEntries(rows.map((r) => [r.key, { enabled: r.enabled, config: r.config }]));
  },
  ["feature-flags"],
  { tags: ["features"], revalidate: 300 },
);

export async function isEnabled(key: FeatureKey) {
  const row = (await overrides())[key];
  return row ? row.enabled : FEATURES[key].enabled;
}

export async function featureConfig<K extends FeatureKey>(key: K): Promise<(typeof FEATURES)[K]["config"]> {
  const row = (await overrides())[key];
  return (row?.config as (typeof FEATURES)[K]["config"] | undefined) ?? FEATURES[key].config;
}

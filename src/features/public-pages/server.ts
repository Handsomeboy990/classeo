import "server-only";

import { cache } from "react";

import { cached } from "@/lib/cache";
import { lookup } from "@/features/languages/service";

import { publicSources } from "./texts";
import { createTranslator, type PublicLang, type PublicTranslator } from "./translate";

export const PUBLIC_TRANSLATIONS_TAG = "public-translations";

// Cached rows of the public texts for one language, read from the
// Translation table only: this never calls the translation service, so an
// anonymous visitor costs nothing of its quota. Kept five minutes, so
// translations loaded into production show up without a deploy.
const cachedRows = cached(
  async (lang: Exclude<PublicLang, "fr">) => Object.fromEntries(await lookup(lang, publicSources())),
  ["public-translations"],
  { tags: [PUBLIC_TRANSLATIONS_TAG] },
);

// The lookup of a public page. French needs no query. A database outage
// leaves the page in French rather than failing it.
export const publicTranslator = cache(async (lang: PublicLang): Promise<PublicTranslator> => {
  if (lang === "fr") return createTranslator("fr", {});
  try {
    return createTranslator(lang, await cachedRows(lang));
  } catch (error) {
    console.error("public translations unavailable", error);
    return createTranslator(lang, {});
  }
});

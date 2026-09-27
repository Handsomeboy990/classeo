import { PUBLIC } from "@/features/public-pages/texts";
import type { PublicTranslator } from "@/features/public-pages/translate";

import { validGaId } from "./consent";
import { GoogleAnalytics } from "./google-analytics";

// Place of the optional Google Analytics on the public pages: nothing at all
// unless NEXT_PUBLIC_GA_ID holds a measurement id. The banner texts come in
// the language of the page (their translations are prepared with the other
// public texts).
export function AnalyticsSlot({ tr }: { tr?: PublicTranslator }) {
  const gaId = validGaId(process.env.NEXT_PUBLIC_GA_ID);
  if (!gaId) return null;
  const t = tr?.t ?? ((french: string) => french);
  const a = PUBLIC.analytics;
  return <GoogleAnalytics gaId={gaId} lang={tr?.lang ?? "fr"} texts={{ text: t(a.text), accept: t(a.accept), decline: t(a.decline), withdraw: t(a.withdraw) }} />;
}

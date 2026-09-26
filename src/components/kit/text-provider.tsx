"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type Texts = { lang: string; t: (french: string) => string };

const TextContext = createContext<Texts>({ lang: "fr", t: (french) => french });

// Messages and labels are written in French. A public page shown in Fongbe
// or Yoruba wraps its forms in this provider with the prepared translations
// of its fixed texts, keyed by the French source: the forms, FormField
// errors and ActionForm messages look their text up here. Anywhere else the
// French text is used as it is.
export function TextProvider({ lang, texts, children }: { lang: string; texts: Record<string, string>; children: ReactNode }) {
  const value = useMemo<Texts>(() => ({ lang, t: (french) => texts[french] ?? french }), [lang, texts]);
  return <TextContext.Provider value={value}>{children}</TextContext.Provider>;
}

export function useText() {
  return useContext(TextContext);
}

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BRAND_DEFAULTS, INDEPENDENCE_NOTICE, type BrandSettings, type IndependenceNoticeVariant } from "./settings";

// The independence notice (design source of truth, part 3.6), placed by the
// public footer, the app footer, the sign in pages, the public menu drawer,
// the app's Menu sheet and the status pages.
//
// The text is shown whole, in the DOM, at every width and text size: no
// truncation, no tooltip, no reduced opacity, no italics, no capitals. It
// renders nothing only when the option brand.independenceNotice is off.
//
// variant "short" ("Plateforme indépendante") is for the documents issued by
// schools; the PDF renderer uses INDEPENDENCE_NOTICE.short directly.
//
// On a translated page, pass the translation: the French sentence stays
// first (lang="fr", translate="no", it is the one that holds), followed by
// the translation in brackets.
export function IndependenceNotice({
  brand = BRAND_DEFAULTS,
  variant = "full",
  tone = "light",
  translation,
  className,
}: {
  brand?: BrandSettings;
  variant?: IndependenceNoticeVariant;
  // dark: on the navy footer or header; light: on a light surface.
  tone?: "light" | "dark";
  translation?: ReactNode;
  className?: string;
}) {
  if (!brand.notice) return null;
  return (
    <p
      className={cn("flex items-start gap-1.5 text-xs leading-normal font-medium", tone === "dark" ? "text-footer-muted" : "text-muted", className)}
      data-independence-notice=""
    >
      <Info className="mt-[0.1875rem] size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span lang="fr" translate="no">
          {INDEPENDENCE_NOTICE[variant]}
        </span>
        {translation != null && <> ({translation})</>}
      </span>
    </p>
  );
}

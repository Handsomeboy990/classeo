"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useOptimistic, useTransition } from "react";

import { Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { choiceQuery, isPublicLang, PUBLIC_LANGS, type PublicLang } from "./translate";

type Choice = { lang: PublicLang; voice: PublicLang };

// Language of the page and language of the voice, for signed out visitors.
// Both live in the address (?lang=fon&voix=yo): the server renders the page
// in that language, a link can be shared, and the choice follows the visitor
// from page to page through the links. Native selects: three choices, the
// system picker on a phone, known to every screen reader. Without
// JavaScript the form is sent as it is (GET), with a button to apply it.
export function LanguageControls({
  lang,
  voice,
  labels,
  extra = {},
  className,
}: {
  lang: PublicLang;
  voice: PublicLang;
  labels: { language: string; voice: string; apply: string };
  // Other parameters of the page kept on change (?next= on the sign in page).
  extra?: Record<string, string | undefined>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic<Choice>({ lang, voice });
  const langId = useId();
  const voiceId = useId();

  function go(next: Choice) {
    startTransition(() => {
      setShown(next);
      router.replace(`${pathname}${choiceQuery(next.lang, next.voice, extra)}`, { scroll: false });
    });
  }

  function changePage(value: string) {
    if (!isPublicLang(value)) return;
    // A voice that matched the page follows it.
    go({ lang: value, voice: shown.voice === shown.lang ? value : shown.voice });
  }

  function changeVoice(value: string) {
    if (isPublicLang(value)) go({ lang: shown.lang, voice: value });
  }

  const field = "flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2";
  const label = "text-xs font-semibold text-muted sm:text-sm";
  const select = "sm:w-36";

  return (
    <form method="get" action={pathname} aria-busy={pending || undefined} className={cn("grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4", className)}>
      {Object.entries(extra).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <div className={field}>
        <Label htmlFor={langId} className={label}>
          {labels.language}
        </Label>
        <Select id={langId} name="lang" value={shown.lang} onChange={(e) => changePage(e.target.value)} className={select}>
          {PUBLIC_LANGS.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>
      <div className={field}>
        <Label htmlFor={voiceId} className={label}>
          {labels.voice}
        </Label>
        <Select id={voiceId} name="voix" value={shown.voice} onChange={(e) => changeVoice(e.target.value)} className={select}>
          {PUBLIC_LANGS.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>
      <noscript>
        <button type="submit" className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold">
          {labels.apply}
        </button>
      </noscript>
    </form>
  );
}

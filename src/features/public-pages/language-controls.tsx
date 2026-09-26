"use client";

import { usePathname } from "next/navigation";

import { LanguageGroup, LanguageLinkOption, LanguageMenu, languageCode } from "@/components/shell/language-menu";

import { choiceQuery, PUBLIC_LANGS, type PublicLang } from "./translate";

// Language of the page and language of the voice, for signed out visitors,
// in the header: the compact control of the private space's top bar. Both
// live in the address (?lang=fon&voix=yo): the server renders the page in
// that language, a link can be shared, and the choice follows the visitor
// from page to page through the links. Every choice is a plain link, and
// the panel opens through the Popover API's popovertarget: it works before
// hydration and without JavaScript.
export function LanguageControls({
  lang,
  voice,
  labels,
  extra = {},
  tone = "default",
  className,
}: {
  lang: PublicLang;
  voice: PublicLang;
  labels: { language: string; voice: string };
  // Other parameters of the page kept on change (?next= on the sign in page).
  extra?: Record<string, string | undefined>;
  tone?: "default" | "inverse";
  className?: string;
}) {
  const pathname = usePathname();
  const current = PUBLIC_LANGS.find((l) => l.code === lang)?.label ?? "Français";
  // A voice that matched the page follows it.
  const pageHref = (next: PublicLang) => `${pathname}${choiceQuery(next, voice === lang ? next : voice, extra)}`;
  const voiceHref = (next: PublicLang) => `${pathname}${choiceQuery(lang, next, extra)}`;

  return (
    <LanguageMenu code={languageCode(lang)} current={current} title={labels.language} tone={tone} className={className}>
      {(close) => (
        <>
          <LanguageGroup title={labels.language}>
            {PUBLIC_LANGS.map((l) => (
              <LanguageLinkOption key={l.code} href={pageHref(l.code)} replace scroll={false} onClick={close} code={l.code} label={l.label} selected={l.code === lang} />
            ))}
          </LanguageGroup>
          <LanguageGroup title={labels.voice}>
            {PUBLIC_LANGS.map((l) => (
              <LanguageLinkOption key={l.code} href={voiceHref(l.code)} replace scroll={false} onClick={close} code={l.code} label={l.label} selected={l.code === voice} />
            ))}
          </LanguageGroup>
        </>
      )}
    </LanguageMenu>
  );
}

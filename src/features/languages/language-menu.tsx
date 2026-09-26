"use client";

import { Eye } from "lucide-react";

import { LanguageButtonOption, LanguageGroup, LanguageMenu, languageCode } from "@/components/shell/language-menu";
import { cn } from "@/lib/utils";

import { setLanguage, setShowOriginal, useLanguageState } from "./client";
import { LANGUAGES, languageLabel } from "./languages";

// Language of the interface, in the top bar of the private space, for the
// users holding translation:view (the layout only renders it for them, with
// the languages the option allows). The choice applies at once; while a
// local language is on, "Voir en français" shows the original text.
export function SpaceLanguageMenu({ languages, className }: { languages: string[]; className?: string }) {
  const s = useLanguageState();
  const choices = LANGUAGES.filter((l) => l.code === "fr" || languages.includes(l.code));
  const label = languageLabel(s.lang);
  const shown = s.lang !== "fr" && s.showOriginal ? "fr" : s.lang;

  return (
    <LanguageMenu code={languageCode(shown)} current={label} className={className}>
      <LanguageGroup title="Langue de l'interface">
        {choices.map((l) => (
          <LanguageButtonOption key={l.code} code={l.code} label={l.label} selected={s.lang === l.code} onSelect={() => setLanguage(l.code)} />
        ))}
      </LanguageGroup>
      {s.lang !== "fr" && (
        <div className="border-t border-border px-1 pt-1.5 pb-1">
          <button
            type="button"
            aria-pressed={s.showOriginal}
            onClick={() => setShowOriginal(!s.showOriginal)}
            className={cn(
              "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-semibold hover:bg-surface-2 lg:min-h-10",
              s.showOriginal && "text-primary",
            )}
          >
            <Eye className="size-4 shrink-0 text-muted" aria-hidden />
            {s.showOriginal ? `Revenir au ${label.toLowerCase()}` : "Voir en français"}
          </button>
        </div>
      )}
      {s.status && <p className="border-t border-border px-2.5 pt-2 pb-1.5 text-xs leading-snug text-muted">{s.status}</p>}
    </LanguageMenu>
  );
}

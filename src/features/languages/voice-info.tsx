"use client";

import { useEffect, useState } from "react";

import { describeVoice } from "@/lib/voice/kora";

import { useLanguageState } from "./client";
import { inLanguage, languageLabel, voiceOf } from "./languages";

type Described = Awaited<ReturnType<typeof describeVoice>>;

const GENDER = { female: "féminine", male: "masculine", unknown: "timbre non précisé" } as const;

// Which voice reads on this device, as shown in Préférences.
export function VoiceInfo() {
  const [voice, setVoice] = useState<Described | "loading">("loading");
  const s = useLanguageState();

  useEffect(() => {
    let alive = true;
    void describeVoice().then((v) => alive && setVoice(v));
    return () => {
      alive = false;
    };
  }, []);

  const local = s.allowed && s.lang !== "fr" ? voiceOf(s.lang, s.voices) : null;

  return (
    <section aria-labelledby="voice-info-title" className="mt-5 rounded-card border border-border bg-surface-2 px-4 py-3 text-sm" data-no-translate>
      <h3 id="voice-info-title" className="font-semibold">
        Voix utilisée
      </h3>
      <p className="mt-1" role="status">
        {voice === "loading"
          ? "Recherche de la voix de cet appareil…"
          : !voice
            ? "Ce navigateur ne sait pas lire à voix haute : le texte reste affiché."
            : !voice.name
              ? "Aucune voix française n'est installée sur cet appareil."
              : `Français : ${voice.name} (${GENDER[voice.gender]}${voice.online ? ", en ligne" : ", sur l'appareil"}).`}
      </p>
      {voice !== "loading" && voice?.synthetic && (
        <p className="mt-1 text-muted">
          C&apos;est une voix de synthèse : Kora la rend un peu plus aiguë et plus lente pour qu&apos;elle reste claire. Pour une voix plus naturelle, utilisez Chrome ou Edge, ou installez une voix française féminine dans les réglages de l&apos;ordinateur.
        </p>
      )}
      {s.allowed && s.lang !== "fr" && (
        <p className="mt-1">
          {local
            ? `${languageLabel(s.lang)} : voix du service de traduction, lecture ${inLanguage(s.lang)}. Si elle ne répond pas, Kora lit en français.`
            : `${languageLabel(s.lang)} : pas encore de voix dans cette langue, Kora lit en français.`}
        </p>
      )}
    </section>
  );
}

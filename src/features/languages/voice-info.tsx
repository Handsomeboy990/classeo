"use client";

import { useEffect, useState } from "react";

import { describeVoice } from "@/lib/voice/kora";

import { useLanguageState } from "./client";
import { inLanguage, languageLabel, voiceOf } from "./languages";

type Described = Awaited<ReturnType<typeof describeVoice>>;
type Device = Described["device"];

const GENDER = { female: "féminine", male: "masculine", unknown: "timbre non précisé" } as const;

function deviceLine(device: Device) {
  if (!device) return "ce navigateur ne sait pas lire à voix haute : le texte reste affiché.";
  if (!device.name) return "aucune voix française n'est installée sur cet appareil.";
  return `${device.name} (${GENDER[device.gender]}${device.online ? ", en ligne" : ", sur l'appareil"}).`;
}

// Which voice reads, as shown in Préférences: the voice of the server when
// it has one (the same on every device), and the voice of this device,
// used without it.
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
  const device = voice === "loading" ? null : voice.device;

  return (
    <section aria-labelledby="voice-info-title" className="mt-5 rounded-card border border-border bg-surface-2 px-4 py-3 text-sm" data-no-translate>
      <h3 id="voice-info-title" className="font-semibold">
        Voix utilisée
      </h3>
      <p className="mt-1" role="status">
        {voice === "loading"
          ? "Recherche de la voix…"
          : voice.server
            ? `Français : voix ${voice.server}, la même sur tous les appareils.`
            : `Français : voix de cet appareil, ${deviceLine(voice.device)}`}
      </p>
      {voice !== "loading" && voice.server && <p className="mt-1 text-muted">Sans connexion, Kora lit avec la voix de cet appareil : {deviceLine(voice.device)}</p>}
      {voice !== "loading" && !voice.server && device?.synthetic && (
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

"use client";

import { useId, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import { NORMAL_RATE, storedRate } from "@/lib/voice/kora";

type Prefs = { theme: string; contrast: string; text: string; lite: string; rate: string };
const DEFAULTS: Prefs = { theme: "system", contrast: "normal", text: "md", lite: "off", rate: NORMAL_RATE };

const listeners = new Set<() => void>();
let cache: { key: string; value: Prefs } | null = null;

function snapshot(): Prefs {
  const value = read();
  const key = JSON.stringify(value);
  if (!cache || cache.key !== key) cache = { key, value };
  return cache.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(): Prefs {
  try {
    return {
      theme: localStorage.getItem("classeo:theme") ?? DEFAULTS.theme,
      contrast: localStorage.getItem("classeo:contrast") ?? DEFAULTS.contrast,
      text: localStorage.getItem("classeo:text") ?? DEFAULTS.text,
      lite: localStorage.getItem("classeo:lite") ?? DEFAULTS.lite,
      rate: storedRate(localStorage.getItem("classeo:voice-rate")),
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const d = document.documentElement;
  d.dataset.theme = p.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : p.theme;
  d.dataset.contrast = p.contrast;
  d.dataset.text = p.text;
  d.dataset.lite = p.lite;
  try {
    localStorage.setItem("classeo:theme", p.theme);
    localStorage.setItem("classeo:contrast", p.contrast);
    localStorage.setItem("classeo:text", p.text);
    localStorage.setItem("classeo:lite", p.lite);
    localStorage.setItem("classeo:voice-rate", p.rate);
  } catch {
    // Private mode: preferences apply for this visit only.
  }
}

function Choice({ legend, value, options, onChange }: { legend: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  // A name of its own: the settings can be mounted several times at once (the
  // floating button, the account sheet, the Menu sheet), and radios sharing a
  // name across the page would form a single group.
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, label]) => (
          <label
            key={v}
            className={cn(
              // The radio is visually hidden: its keyboard focus is drawn on the label.
              "inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid",
              value === v ? "border-primary bg-primary-soft text-primary" : "border-border-strong bg-surface text-text hover:bg-surface-2",
            )}
          >
            <input type="radio" className="sr-only" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Display and voice preferences, stored on this device and applied at once.
export function AccessibilityControls() {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULTS);

  function update(patch: Partial<Prefs>) {
    apply({ ...prefs, ...patch });
    listeners.forEach((l) => l());
  }

  return (
    <div className="flex flex-col gap-5">
      <Choice
        legend="Taille du texte"
        value={prefs.text}
        onChange={(text) => update({ text })}
        options={[
          ["md", "Normale"],
          ["lg", "Grande"],
          ["xl", "Très grande"],
          ["xxl", "Maximale"],
        ]}
      />
      <Choice
        legend="Contraste"
        value={prefs.contrast}
        onChange={(contrast) => update({ contrast })}
        options={[
          ["normal", "Standard"],
          ["high", "Élevé"],
        ]}
      />
      <Choice
        legend="Thème"
        value={prefs.theme}
        onChange={(theme) => update({ theme })}
        options={[
          ["system", "Automatique"],
          ["light", "Clair"],
          ["dark", "Sombre"],
        ]}
      />
      <Choice
        legend="Vitesse de la voix"
        value={prefs.rate}
        onChange={(rate) => update({ rate })}
        options={[
          ["0.75", "Lente"],
          [NORMAL_RATE, "Normale"],
          ["1.2", "Rapide"],
        ]}
      />
      <Choice
        legend="Économie de données"
        value={prefs.lite}
        onChange={(lite) => update({ lite })}
        options={[
          ["off", "Désactivée"],
          ["on", "Activée (sans images)"],
        ]}
      />
    </div>
  );
}

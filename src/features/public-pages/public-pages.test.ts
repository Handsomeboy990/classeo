import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { RESET_CODE_MINUTES } from "@/features/auth/reset-code";
import { cacheKey } from "@/features/languages/cache-key";
import { normalise, segments } from "@/features/languages/text";
import { PUBLIC_SPEECH_TEXTS } from "@/lib/voice/public-texts";

import { creditsMarkdown, LICENCES, PHOTOS } from "./photos";
import { PUBLIC, PUBLIC_SPEECH, publicSources } from "./texts";
import { acceptTranslation, choiceQuery, createTranslator, publicChoice } from "./translate";

const ROOT = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

describe("public translation lookup", () => {
  const cached = {
    "Se connecter": "Mi byɔ mɛ",
    "Crédits photos": "Fótóo lɛ",
    // Broken answers of the service, all kept in French.
    Langue: "",
    Voix: "Voix",
    "Prototype présenté au défi EduTech Bénin 2026.": "Prototype ɖò EduTech Bénin 2025 mɛ.",
    "Plateforme nationale de l'éducation, prototype présenté au défi EduTech Bénin, 2026.": "Azɔ̌watɛn tò ɔ tɔn, ɖò défi Bénin, 2026.",
    "Accessible à tous": "mɛ mɛ mɛ mɛ",
    // Names and identifiers kept as written: accepted.
    "Votre prénom et votre nom, séparés par un point. Par exemple : afiavi.hounkpatin": "Nyikɔ towe kpo xwédo towe kpo. Ðiðɔ : afiavi.hounkpatin",
    "Des élèves lisent ensemble, à Grand-Popo.": "Wemaxɔmɛvi lɛ ɖò wema xa wɛ ɖò Grand-Popo.",
    // The identifier changed by the model: refused.
    "Si une autre personne porte déjà le même nom, un chiffre est ajouté à la fin, par exemple afiavi.hounkpatin2.": "Nǔ ɖé, afiavi hounkpatin 2.",
  };

  it("shows the translation when the cache has a sound one", () => {
    const tr = createTranslator("fon", cached);
    expect(tr.t("Se connecter")).toBe("Mi byɔ mɛ");
    expect(tr.t("  Crédits   photos ")).toBe("Fótóo lɛ");
    expect(tr.t(PUBLIC.signIn.identifierHint)).toContain("afiavi.hounkpatin");
    expect(tr.t("Des élèves lisent ensemble, à Grand-Popo.")).toContain("Grand-Popo");
  });

  it("falls back to French for a missing text", () => {
    const tr = createTranslator("yo", cached);
    expect(tr.t("Mot de passe oublié ?")).toBe("Mot de passe oublié ?");
    expect(tr.texts).not.toHaveProperty("Mot de passe oublié ?");
  });

  it("keeps French when the translation is empty, unchanged, changes a figure, loses a name or stutters", () => {
    const tr = createTranslator("fon", cached);
    for (const source of [
      "Langue",
      "Voix",
      "Prototype présenté au défi EduTech Bénin 2026.",
      "Plateforme nationale de l'éducation, prototype présenté au défi EduTech Bénin, 2026.",
      "Accessible à tous",
      "Si une autre personne porte déjà le même nom, un chiffre est ajouté à la fin, par exemple afiavi.hounkpatin2.",
    ])
      expect(tr.t(source)).toBe(source);
    expect(acceptTranslation("Utiliser Classéo", "Klasewo zán")).toBeNull();
    // A name that only lost its accents is written back as it should be.
    expect(acceptTranslation("Utiliser Classéo hors ligne au Bénin", "Lo Classeo offline ni Benin")).toBe("Lo Classéo offline ni Bénin");
    expect(acceptTranslation("Voir <b>", "Kpɔ́n <b>")).toBeNull();
  });

  it("never touches a name, which is not in the list", () => {
    const tr = createTranslator("fon", { ...cached, "Rofik Adam": "Rofiki Adamu" });
    expect(tr.t("Thomas Dorn")).toBe("Thomas Dorn");
    expect(tr.t("EPP Savi, Godomey")).toBe("EPP Savi, Godomey");
    for (const p of PHOTOS) expect(publicSources()).not.toContain(p.author);
  });

  it("marks a French fallback with lang=fr on a translated page only", () => {
    const fon = createTranslator("fon", cached);
    expect(fon.node("Se connecter")).toBe("Mi byɔ mɛ");
    const fallback = fon.node("Mot de passe oublié ?");
    expect(isValidElement(fallback) && (fallback.props as { lang?: string }).lang).toBe("fr");
    const fr = createTranslator("fr", cached);
    expect(fr.t("Se connecter")).toBe("Se connecter");
    expect(fr.node("Mot de passe oublié ?")).toBe("Mot de passe oublié ?");
  });
});

describe("public choice in the address", () => {
  it("reads the page and voice languages, French by default", () => {
    expect(publicChoice({})).toEqual({ lang: "fr", voice: "fr" });
    expect(publicChoice({ lang: "fon" })).toEqual({ lang: "fon", voice: "fon" });
    expect(publicChoice({ lang: "yo", voix: "fr" })).toEqual({ lang: "yo", voice: "fr" });
    expect(publicChoice({ lang: "xx", voix: ["fon", "yo"] })).toEqual({ lang: "fr", voice: "fon" });
  });

  it("writes only what differs from French and from the page", () => {
    expect(choiceQuery("fr", "fr")).toBe("");
    expect(choiceQuery("fon", "fon")).toBe("?lang=fon");
    expect(choiceQuery("fr", "yo")).toBe("?voix=yo");
    expect(choiceQuery("yo", "fr", { next: "/espace/notes" })).toBe("?next=%2Fespace%2Fnotes&lang=yo&voix=fr");
  });
});

describe("public texts", () => {
  it("lets the voice find every line of a spoken text in the list", () => {
    const sources = new Set(publicSources().map(normalise));
    for (const text of Object.values(PUBLIC_SPEECH)) {
      expect(PUBLIC_SPEECH_TEXTS).toContain(text);
      for (const part of segments(text)) expect(sources.has(part), part).toBe(true);
    }
  });

  it("lists the exact messages of the sign in and help actions", () => {
    const code = read("src/features/auth/actions.ts") + read("src/features/password-help/actions.ts");
    for (const message of Object.values(PUBLIC.messages)) expect(code, message).toContain(message);
  });

  it("states the lifetime of the reset code", () => {
    expect(PUBLIC.code.asideBody).toContain(`${RESET_CODE_MINUTES} minutes`);
  });

  it("has a prepared Fon and Yoruba row for every text, shipped with the seed", () => {
    const rows = JSON.parse(read("prisma/seed-extras/translations.json")) as { key: string; lang: string }[];
    const have = new Set(rows.map((r) => `${r.lang}:${r.key}`));
    const missing = publicSources().flatMap((s) => ["fon", "yo"].filter((l) => !have.has(`${l}:${cacheKey(s)}`)).map((l) => `${l}: ${s}`));
    expect(missing, "run npx tsx scripts/pretranslate.ts --public").toEqual([]);
  });
});

describe("photo credits", () => {
  it("credits every photograph of public/images", () => {
    const files = readdirSync(path.join(ROOT, "public/images")).filter((f) => f.endsWith(".webp"));
    expect(PHOTOS.map((p) => p.file).sort()).toEqual(files.sort());
    for (const p of PHOTOS) {
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(LICENCES[p.licence]).toBeDefined();
    }
  });

  it("keeps CREDITS.md in step with the list", () => {
    expect(read("public/images/CREDITS.md"), "run npx tsx scripts/write-credits.ts").toBe(creditsMarkdown());
  });
});

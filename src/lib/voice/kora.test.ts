import { describe, expect, it } from "vitest";

import { genderOf, isSynthetic, NORMAL_RATE, pickVoice, playbackRateFor, splitSentences, storedRate, voiceSettings } from "./kora";

const v = (name: string, lang = "fr-FR", localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe("pickVoice", () => {
  it("prefers a natural French female voice", () => {
    const voices = [v("Microsoft Paul - French (France)"), v("Google français", "fr-FR", false), v("Microsoft Denise Online (Natural) - French (France)", "fr-FR", false)];
    expect(pickVoice(voices)?.name).toContain("Denise");
  });
  it("never picks a male voice when a female one exists", () => {
    expect(pickVoice([v("Thomas"), v("Amélie", "fr-CA")])?.name).toBe("Amélie");
  });
  it("falls back to any French voice, and to nothing without one", () => {
    expect(pickVoice([v("Thomas")])?.name).toBe("Thomas");
    expect(pickVoice([v("Samantha", "en-US")])).toBeNull();
  });
});

describe("desktop voices", () => {
  it("prefers Google français to the espeak voice of a Linux desktop", () => {
    const voices = [v("French (France)", "fr-FR"), v("espeak-ng French", "fr"), v("Google français", "fr-FR", false), v("Google UK English Male", "en-GB", false)];
    expect(pickVoice(voices)?.name).toBe("Google français");
  });
  it("prefers the Windows female voices to Paul", () => {
    expect(pickVoice([v("Microsoft Paul - French (France)"), v("Microsoft Hortense - French (France)")])?.name).toContain("Hortense");
    expect(pickVoice([v("Microsoft Paul - French (France)"), v("Microsoft Julie - French (France)")])?.name).toContain("Julie");
  });
  it("takes a female espeak variant over the default male one", () => {
    const voices = [v("French (France)"), v("French (France)+female2"), v("French (France)+m3")];
    expect(pickVoice(voices)?.name).toBe("French (France)+female2");
  });
  it("accepts underscore language tags of Android", () => {
    expect(pickVoice([v("fr-fr-x-frc-local", "fr_FR")])?.name).toBe("fr-fr-x-frc-local");
  });
  it("tells genders and synthetic voices apart", () => {
    expect(genderOf(v("Google français"))).toBe("female");
    expect(genderOf(v("Microsoft Paul"))).toBe("male");
    expect(genderOf(v("French (France)+female1"))).toBe("female");
    expect(genderOf(v("French (France)"))).toBe("unknown");
    expect(isSynthetic(v("French (France)"))).toBe(true);
    expect(isSynthetic(v("espeak-ng French"))).toBe(true);
    expect(isSynthetic(v("Google français", "fr-FR", false))).toBe(false);
    expect(isSynthetic(v("Amélie"))).toBe(false);
  });
  it("raises pitch and slows only a synthetic voice", () => {
    expect(voiceSettings(v("Google français", "fr-FR", false), 0.95)).toEqual({ rate: 0.95, pitch: 1 });
    const espeak = voiceSettings(v("French (France)"), 1);
    expect(espeak.pitch).toBeGreaterThan(1);
    expect(espeak.rate).toBeLessThan(1);
    expect(voiceSettings(null, 1.2)).toEqual({ rate: 1.2, pitch: 1 });
  });
});

describe("splitSentences", () => {
  it("cuts on sentence ends and keeps numbers together", () => {
    expect(splitSentences("Sènami, classe de 3e A. Moyenne : 13,25 sur 20. Bien !")).toEqual(["Sènami, classe de 3e A.", "Moyenne : 13,25 sur 20.", "Bien !"]);
  });
});

describe("speed", () => {
  it("reads the old normal pace as the new, slower one", () => {
    expect(storedRate(null)).toBe(NORMAL_RATE);
    expect(storedRate("0.95")).toBe(NORMAL_RATE);
    expect(storedRate("0.75")).toBe("0.75");
    expect(Number(NORMAL_RATE)).toBeLessThan(0.9);
  });
  it("slows a synthetic voice below the chosen pace", () => {
    expect(voiceSettings(v("French (France)"), Number(NORMAL_RATE)).rate).toBeLessThan(Number(NORMAL_RATE));
  });
  it("plays server clips at the normal pace, scaled by the setting", () => {
    expect(playbackRateFor(Number(NORMAL_RATE))).toBe(1);
    expect(playbackRateFor(0.75)).toBeLessThan(1);
    expect(playbackRateFor(1.2)).toBeGreaterThan(1);
    expect(playbackRateFor(5)).toBe(1.5);
  });
});

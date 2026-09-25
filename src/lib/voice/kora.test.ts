import { describe, expect, it } from "vitest";

import { pickVoice, splitSentences } from "./kora";

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

describe("splitSentences", () => {
  it("cuts on sentence ends and keeps numbers together", () => {
    expect(splitSentences("Sènami, classe de 3e A. Moyenne : 13,25 sur 20. Bien !")).toEqual(["Sènami, classe de 3e A.", "Moyenne : 13,25 sur 20.", "Bien !"]);
  });
});

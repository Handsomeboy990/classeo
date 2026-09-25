import { describe, expect, it } from "vitest";

import { buildSsml, escapeXml, frenchParts, MAX_SPOKEN_LENGTH, PART_LENGTH } from "./speech-text";

describe("escapeXml", () => {
  it("escapes the five XML characters and drops control characters", () => {
    expect(escapeXml(`Tom & "Léa" <b>'x'</b>`)).toBe("Tom &amp; &quot;Léa&quot; &lt;b&gt;&apos;x&apos;&lt;/b&gt;");
    expect(escapeXml("a\u0000b\u0007c\u001Fd")).toBe("abcd");
    expect(escapeXml("ligne\nsuivante\ttab")).toBe("ligne\nsuivante\ttab");
  });
});

describe("buildSsml", () => {
  it("wraps the text in the Denise voice with a slower prosody", () => {
    const ssml = buildSsml("Bonjour  Afiavi.");
    expect(ssml).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR"><voice name="fr-FR-DeniseNeural"><prosody rate="-10%">Bonjour Afiavi.</prosody></voice></speak>',
    );
  });
  it("cannot be broken out of by the text", () => {
    const ssml = buildSsml(`</prosody></voice><voice name="x">Pirate & co`);
    expect(ssml).not.toContain('<voice name="x">');
    expect(ssml).toContain("&lt;/prosody&gt;&lt;/voice&gt;&lt;voice name=&quot;x&quot;&gt;Pirate &amp; co");
    expect(ssml.match(/<voice /g)).toHaveLength(1);
  });
});

describe("frenchParts", () => {
  it("keeps a short text whole and ignores blank text", () => {
    expect(frenchParts("  Moyenne : 13,5 sur 20.  Bien ! ")).toEqual(["Moyenne : 13,5 sur 20. Bien !"]);
    expect(frenchParts(" \n ")).toEqual([]);
  });
  it("groups whole sentences into parts of at most PART_LENGTH characters", () => {
    const sentence = "Sènami a obtenu une bonne moyenne ce trimestre en mathématiques.";
    const text = Array.from({ length: 20 }, () => sentence).join(" ");
    const parts = frenchParts(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(PART_LENGTH);
      expect(p.endsWith(".")).toBe(true);
    }
    expect(parts.join(" ")).toBe(text);
  });
  it("cuts an overlong sentence between clauses and words without losing any", () => {
    const text = `${"un mot, ".repeat(60)}${"encore ".repeat(80)}fin.`;
    const parts = frenchParts(text);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(PART_LENGTH);
    expect(parts.join(" ")).toBe(text.trim());
    const word = "a".repeat(PART_LENGTH * 2 + 5);
    expect(frenchParts(word).join("")).toBe(word);
  });
  it("reads at most MAX_SPOKEN_LENGTH characters", () => {
    const parts = frenchParts("Phrase courte. ".repeat(1000));
    expect(parts.join(" ").length).toBeLessThanOrEqual(MAX_SPOKEN_LENGTH);
  });
});

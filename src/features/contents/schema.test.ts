import { describe, expect, it } from "vitest";

import { contentSchema, parseEventDate, toEventInput, TRANSCRIPT_REQUIRED } from "./schema";

const base = {
  type: "ANNOUNCEMENT",
  title: "Réunion des parents",
  body: "Réunion de rentrée samedi à 10 heures.",
  audience: "PARENTS",
  target: "SCHOOL:ceg",
  mediaType: "NONE",
};

function errors(input: Record<string, unknown>) {
  const r = contentSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("contentSchema", () => {
  it("accepts a plain announcement and turns empty fields into null", () => {
    const r = contentSchema.parse({ ...base, easyRead: "", mediaUrl: "" });
    expect(r.easyRead).toBeNull();
    expect(r.mediaUrl).toBeNull();
    expect(r.intent).toBe("draft");
  });

  it("refuses audio or video without a transcript, explaining why", () => {
    expect(errors({ ...base, mediaType: "AUDIO", mediaUrl: "https://exemple.bj/a.mp3" }).transcript).toBe(TRANSCRIPT_REQUIRED);
    expect(errors({ ...base, mediaType: "VIDEO", transcript: "   " }).transcript).toBe(TRANSCRIPT_REQUIRED);
    expect(errors({ ...base, mediaType: "AUDIO", transcript: "Bonjour à tous." })).toEqual({});
  });

  it("refuses dangerous media addresses", () => {
    expect(errors({ ...base, mediaType: "IMAGE", mediaUrl: "javascript:alert(1)" }).mediaUrl).toBeDefined();
    expect(errors({ ...base, mediaType: "IMAGE", mediaUrl: "//evil.example/x.png" }).mediaUrl).toBeDefined();
    expect(errors({ ...base, mediaType: "IMAGE", mediaUrl: "/media/affiche.png" })).toEqual({});
  });

  it("requires a valid date for an event", () => {
    expect(errors({ ...base, type: "EVENT" }).eventDate).toBeDefined();
    expect(errors({ ...base, type: "EVENT", eventDate: "demain" }).eventDate).toBeDefined();
    expect(errors({ ...base, type: "EVENT", eventDate: "2026-10-10T10:00" })).toEqual({});
  });
});

describe("event dates", () => {
  it("reads form values as Benin time and writes them back", () => {
    const d = parseEventDate("2026-10-10T10:00");
    expect(d.toISOString()).toBe("2026-10-10T09:00:00.000Z");
    expect(toEventInput(d)).toBe("2026-10-10T10:00");
    expect(toEventInput(null)).toBe("");
  });
});

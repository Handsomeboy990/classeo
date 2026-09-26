import { describe, expect, it } from "vitest";

import { clock, excerpt, isUnread, spokenDuration, voiceLabel } from "./messaging";

const at = (iso: string) => new Date(iso);

describe("voice note durations", () => {
  it("shows minutes and seconds like an audio player", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(7_400)).toBe("0:07");
    expect(clock(105_000)).toBe("1:45");
    expect(clock(120_000)).toBe("2:00");
  });
  it("names a voice note in lists and notifications", () => {
    expect(voiceLabel(12_000)).toBe("Message vocal (0:12)");
    expect(voiceLabel(null)).toBe("Message vocal");
  });
  it("reads the length in words", () => {
    expect(spokenDuration(1_000)).toBe("1 seconde");
    expect(spokenDuration(7_000)).toBe("7 secondes");
    expect(spokenDuration(60_000)).toBe("1 minute");
    expect(spokenDuration(105_000)).toBe("1 minute 45");
  });
});

describe("isUnread", () => {
  it("is unread when another participant wrote after the last visit", () => {
    expect(isUnread({ senderId: "b", createdAt: at("2026-09-25T10:00:00Z") }, at("2026-09-25T09:00:00Z"), "a")).toBe(true);
  });
  it("is unread when the thread was never opened", () => {
    expect(isUnread({ senderId: "b", createdAt: at("2026-09-25T10:00:00Z") }, null, "a")).toBe(true);
  });
  it("is read once opened after the last message", () => {
    expect(isUnread({ senderId: "b", createdAt: at("2026-09-25T10:00:00Z") }, at("2026-09-25T10:05:00Z"), "a")).toBe(false);
  });
  it("never counts the user's own message", () => {
    expect(isUnread({ senderId: "a", createdAt: at("2026-09-25T10:00:00Z") }, null, "a")).toBe(false);
  });
  it("is read when the thread is empty", () => {
    expect(isUnread(null, null, "a")).toBe(false);
  });
});

describe("excerpt", () => {
  it("keeps short text and flattens whitespace", () => {
    expect(excerpt("Bonjour\n  Madame")).toBe("Bonjour Madame");
  });
  it("cuts long text on a word boundary", () => {
    const r = excerpt("Mon enfant est malade aujourd'hui et ne viendra pas en classe", 30);
    expect(r).toBe("Mon enfant est malade…");
    expect(r.length).toBeLessThanOrEqual(31);
  });
});

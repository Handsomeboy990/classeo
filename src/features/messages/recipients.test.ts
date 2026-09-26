import { describe, expect, it } from "vitest";

import { canShare, deliveryPlan, MAX_RECIPIENTS, MAX_SHARED, resolveRecipients } from "./recipients";

describe("deliveryPlan", () => {
  it("keeps one recipient as a plain conversation", () => {
    expect(deliveryPlan({ senderIsFamily: false, recipientsAreFamily: [true], wantShared: true })).toBe("single");
  });
  it("never puts parents in a shared conversation, even when asked", () => {
    expect(deliveryPlan({ senderIsFamily: false, recipientsAreFamily: [true, true, true], wantShared: true })).toBe("separate");
    expect(deliveryPlan({ senderIsFamily: false, recipientsAreFamily: [false, true], wantShared: true })).toBe("separate");
  });
  it("gives a parent writing to several teachers a private conversation with each", () => {
    expect(deliveryPlan({ senderIsFamily: true, recipientsAreFamily: [false, false], wantShared: true })).toBe("separate");
  });
  it("lets staff choose between a shared conversation and separate ones", () => {
    expect(deliveryPlan({ senderIsFamily: false, recipientsAreFamily: [false, false], wantShared: true })).toBe("shared");
    expect(deliveryPlan({ senderIsFamily: false, recipientsAreFamily: [false, false], wantShared: false })).toBe("separate");
  });
  it("sends separately beyond the size of a shared conversation", () => {
    const many = Array.from({ length: MAX_SHARED + 1 }, () => false);
    expect(canShare(false, many)).toBe(false);
    expect(deliveryPlan({ senderIsFamily: false, recipientsAreFamily: many, wantShared: true })).toBe("separate");
  });
});

describe("resolveRecipients", () => {
  const contacts = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("returns the allowed contacts, once each", () => {
    expect(resolveRecipients(["a", "b", "a"], contacts)).toEqual([{ id: "a" }, { id: "b" }]);
  });
  it("refuses the whole list when one id is not an allowed contact", () => {
    expect(resolveRecipients(["a", "stranger"], contacts)).toBeNull();
  });
  it("refuses an empty list and a list over the maximum", () => {
    expect(resolveRecipients([], contacts)).toBeNull();
    const all = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => ({ id: `u${i}` }));
    expect(resolveRecipients(all.map((c) => c.id), all)).toBeNull();
    expect(resolveRecipients(all.slice(0, MAX_RECIPIENTS).map((c) => c.id), all)).toHaveLength(MAX_RECIPIENTS);
  });
});

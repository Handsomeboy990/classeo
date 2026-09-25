import { describe, expect, it } from "vitest";

import { counts, discard, draftsOf, enqueue, entriesOf, markSending, memoryStore, replayable, sealAll, settle, unseal, type NewEntry } from "./queue";

function grades(userId: string, clientId: string, target = "sheet-1"): NewEntry<"grades"> {
  return {
    clientId,
    userId,
    kind: "grades",
    target,
    payload: { sheetId: target, cells: [{ enrollmentId: "e1", type: "COMPOSITION", sequence: 1, value: 14 }] },
    baseline: { cells: [{ enrollmentId: "e1", type: "COMPOSITION", sequence: 1, value: 8 }] },
    page: `/espace/notes/${target}`,
    label: "Notes",
  };
}

describe("offline queue", () => {
  it("keeps an entry pending with its payload, page and time, and no secret", async () => {
    const store = memoryStore();
    const item = await enqueue(store, grades("u1", "a"), 1000);
    expect(item).toMatchObject({ status: "pending", sealed: false, attempts: 0, createdAt: 1000, page: "/espace/notes/sheet-1" });
    expect(Object.keys(item).sort()).toEqual(["attempts", "baseline", "clientId", "createdAt", "kind", "label", "page", "payload", "sealed", "status", "target", "updatedAt", "userId"]);
  });

  it("only lists and replays the entries of the signed in account", async () => {
    const store = memoryStore();
    await enqueue(store, grades("u1", "a"), 1);
    await enqueue(store, grades("u2", "b"), 2);
    expect((await entriesOf(store, "u1")).map((i) => i.clientId)).toEqual(["a"]);
    expect((await replayable(store, "u2")).map((i) => i.clientId)).toEqual(["b"]);
  });

  it("seals every entry at sign out and unseals only the owner's", async () => {
    const store = memoryStore();
    await enqueue(store, grades("u1", "a"), 1);
    await enqueue(store, grades("u2", "b"), 2);
    await sealAll(store);
    expect(await replayable(store, "u1")).toEqual([]);
    expect(await entriesOf(store, "u2")).toEqual([]);
    await unseal(store, "u2");
    expect((await replayable(store, "u2")).map((i) => i.clientId)).toEqual(["b"]);
    expect(await replayable(store, "u1")).toEqual([]);
    expect((await store.all()).length).toBe(2);
  });

  it("removes an applied entry and keeps a refused one with its reason", async () => {
    const store = memoryStore();
    const a = await enqueue(store, grades("u1", "a"), 1);
    const b = await enqueue(store, grades("u1", "b"), 2);
    expect(await settle(store, a, { outcome: "applied" })).toBe("applied");
    expect(await settle(store, b, { outcome: "rejected", reason: "Fiche verrouillée" })).toBe("rejected");
    const left = await entriesOf(store, "u1");
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ clientId: "b", status: "rejected", error: "Fiche verrouillée", payload: b.payload });
    expect(await replayable(store, "u1")).toEqual([]);
    expect(counts(left)).toEqual({ pending: 0, rejected: 1 });
  });

  it("keeps the entry for later on a temporary failure or a missing session", async () => {
    const store = memoryStore();
    const a = await enqueue(store, grades("u1", "a"), 1);
    await markSending(store, "a");
    expect(await settle(store, a, { outcome: "retry" })).toBe("kept");
    expect(await settle(store, a, { outcome: "auth" })).toBe("kept");
    expect((await replayable(store, "u1")).map((i) => i.status)).toEqual(["pending"]);
  });

  it("seals an entry the server saw under another account", async () => {
    const store = memoryStore();
    const a = await enqueue(store, grades("u1", "a"), 1);
    await settle(store, a, { outcome: "other-user" });
    expect(await replayable(store, "u1")).toEqual([]);
    await unseal(store, "u1");
    expect(await replayable(store, "u1")).toHaveLength(1);
  });

  it("sends again an entry stuck in sending after a page was closed", async () => {
    const store = memoryStore();
    await enqueue(store, grades("u1", "a"), 1);
    await markSending(store, "a", 1000);
    expect(await replayable(store, "u1", 2000)).toEqual([]);
    expect(await replayable(store, "u1", 1000 + 61_000)).toHaveLength(1);
  });

  it("lets only the owner discard an entry", async () => {
    const store = memoryStore();
    await enqueue(store, grades("u1", "a"), 1);
    await discard(store, "u2", "a");
    expect(await store.get("a")).toBeDefined();
    await discard(store, "u1", "a");
    expect(await store.get("a")).toBeUndefined();
  });

  it("splits the drafts of a page into waiting and refused", async () => {
    const store = memoryStore();
    const a = await enqueue(store, grades("u1", "a"), 1);
    await enqueue(store, grades("u1", "b"), 2);
    await enqueue(store, grades("u1", "c", "sheet-2"), 3);
    await settle(store, a, { outcome: "rejected", reason: "x" });
    const drafts = draftsOf(await entriesOf(store, "u1"), "grades", "sheet-1");
    expect(drafts.pending.map((i) => i.clientId)).toEqual(["b"]);
    expect(drafts.rejected.map((i) => i.clientId)).toEqual(["a"]);
  });
});

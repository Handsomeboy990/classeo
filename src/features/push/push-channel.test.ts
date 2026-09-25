import { beforeEach, describe, expect, it, vi } from "vitest";

// The push channel: every subscription of the recipients is tried, expired
// ones (404, 410) are deleted, nothing ever throws back to notify().

vi.mock("server-only", () => ({}));

const { sendNotification, db, WebPushError } = vi.hoisted(() => {
  class WebPushError extends Error {
    constructor(public statusCode: number) {
      super(`push service answered ${statusCode}`);
    }
  }
  return {
    WebPushError,
    sendNotification: vi.fn(),
    db: {
      pushSubscription: {
        findMany: vi.fn(),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    },
  };
});

vi.mock("web-push", () => ({ default: { sendNotification }, WebPushError }));
vi.mock("@/lib/db", () => ({ db }));

import { deliverPush, pushPublicKey, sendPush } from "@/lib/channels/push";

const input = { kind: "absence", title: "Absence", body: "Koffi était absent ce matin.", link: "/espace/suivi/s1/presences" };
const subs = [
  { id: "ok", endpoint: "https://push.example/ok", p256dh: "p", auth: "a" },
  { id: "gone", endpoint: "https://push.example/gone", p256dh: "p", auth: "a" },
  { id: "down", endpoint: "https://push.example/down", p256dh: "p", auth: "a" },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = "public";
  process.env.VAPID_PRIVATE_KEY = "private";
  process.env.VAPID_SUBJECT = "mailto:contact@classeo.bj";
  db.pushSubscription.findMany.mockResolvedValue(subs);
  sendNotification.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
    if (endpoint.endsWith("/gone")) throw new WebPushError(410);
    if (endpoint.endsWith("/down")) throw new WebPushError(503);
    return { statusCode: 201 };
  });
});

describe("push channel", () => {
  it("is off without the VAPID keys", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushPublicKey()).toBeNull();
    expect(await sendPush(["u1"], input)).toEqual({ sent: 0, failed: 0 });
    expect(db.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it("sends to every subscription and deletes the expired ones", async () => {
    const result = await sendPush(["u1", "u2"], input);
    expect(result).toEqual({ sent: 1, failed: 2 });
    expect(db.pushSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { in: ["u1", "u2"] } } }));
    expect(sendNotification).toHaveBeenCalledTimes(3);
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["gone"] } } });
    expect(db.pushSubscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["ok"] } } }));
  });

  it("only carries links inside the private space", async () => {
    await sendPush(["u1"], { ...input, link: "https://evil.example" });
    const payload = JSON.parse(sendNotification.mock.calls[0]![1] as string);
    expect(payload).toMatchObject({ title: "Absence", link: "/espace/notifications", tag: "absence" });
  });

  it("never throws", async () => {
    db.pushSubscription.findMany.mockRejectedValue(new Error("database down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deliverPush(["u1"], input)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

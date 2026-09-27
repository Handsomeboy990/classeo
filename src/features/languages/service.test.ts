import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The translation service with the database and the network replaced: what
// actually leaves the platform is what the fake fetch receives.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ hitRateLimit: async () => ({ allowed: true, count: 1, retryAfterMs: 0 }) }));
vi.mock("@/lib/features", () => ({
  isEnabled: async () => true,
  featureConfig: async () => ({ languages: ["fon", "yo"] }),
}));

// Names of the demonstration data, and a message the demo parent received.
const PEOPLE = ["Afiavi", "Hounkpatin", "Sènami", "Florentin", "Agossou"];
const MESSAGE = "je voulais savoir si la réunion tient toujours demain";
const db = {
  translation: { findMany: vi.fn(async () => []), createMany: vi.fn(async () => ({ count: 0 })) },
  fileBlob: { findFirst: vi.fn(async () => null), create: vi.fn() },
  $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    if (sql.includes('FROM "Student"')) return PEOPLE.map((n) => ({ n }));
    if (sql.includes('FROM "Message"')) return (values[0] as string[]).filter((t) => MESSAGE.includes(t) || t.includes(MESSAGE)).map((t) => ({ t }));
    return [];
  }),
};
vi.mock("@/lib/db", () => ({ db }));

const sent: string[] = [];
const spoken: string[] = [];
const fakeFetch = vi.fn(async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body)) as { texts?: string[]; text?: string };
  if (url.endsWith("/tts")) {
    spoken.push(body.text ?? "");
    return new Response(new Uint8Array(200), { headers: { "content-type": "audio/mpeg" } });
  }
  const texts = body.texts ?? [];
  sent.push(...texts);
  return Response.json({ success: true, data: texts.map((t, index) => ({ index, success: true, translated_text: `FON ${t}` })) });
});

const { drain, queueInterface, speech, translateNow } = await import("./service");

beforeAll(() => {
  vi.stubEnv("LANGUES229_API_URL", "https://api.test");
  vi.stubEnv("LANGUES229_API_KEY", "key");
  vi.stubEnv("LANGUES229_HF_TOKEN", "hf");
  vi.stubGlobal("fetch", fakeFetch);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  sent.length = 0;
  spoken.length = 0;
});

const NAME = /Afiavi|Hounkpatin|Sènami|Florentin|Agossou/;

describe("interface queue", () => {
  it("never sends a demo person's name, and sends the template instead", async () => {
    const queued = await queueInterface("fon", ["Nouveau message de Afiavi Hounkpatin", "Voir le bulletin", "Appelez le 97 12 34 56", "Écrire à parent@classeo.bj"], { userId: "u1" });
    expect(queued).toBe(2);
    await drain();
    expect(sent).toEqual(expect.arrayContaining(["Nouveau message de 2", "Voir le bulletin"]));
    expect(sent.join("\n")).not.toMatch(NAME);
    expect(sent.join("\n")).not.toMatch(/97 12|@/);
  });

  it("never sends a piece of a message the user can read", async () => {
    const queued = await queueInterface("fon", [MESSAGE, "Marquer comme lu"], { userId: "u1" });
    expect(queued).toBe(1);
    await drain();
    expect(sent).toEqual(["Marquer comme lu"]);
  });

  it("templates the names of the reader's page given by the server", async () => {
    await queueInterface("fon", ["Bulletin de Koffi"], { userId: "u1", names: ["Koffi"] });
    await drain();
    expect(sent).toEqual(["Bulletin de 2"]);
  });
});

describe("translation on request", () => {
  it("sends a free text as templates and puts the names back", async () => {
    const { translations, personal } = await translateNow("fon", ["Bulletin de Sènami Hounkpatin : moyenne 13,5 sur 20."], 1000, { kind: "free", userId: "u1" });
    expect(sent).toEqual(["Bulletin de 2 : moyenne 3 sur 4."]);
    expect(translations.get("Bulletin de Sènami Hounkpatin : moyenne 13,5 sur 20.")).toBe("FON Bulletin de Sènami Hounkpatin : moyenne 13,5 sur 20.");
    expect(personal).toBe(true);
  });

  it("keeps a message French when a page asks for it", async () => {
    const { translations, complete } = await translateNow("fon", [`Afiavi a écrit : ${MESSAGE}`], 1000, { kind: "free", userId: "u1" });
    expect(sent).toEqual([]);
    expect(translations.size).toBe(0);
    expect(complete).toBe(false);
  });

  it("translates a published announcement as written", async () => {
    await translateNow("fon", ["Réunion des parents samedi à 9 h."], 1000, { kind: "published" });
    expect(sent).toEqual(["Réunion des parents samedi à 9 h."]);
  });
});

describe("speech", () => {
  it("refuses a free text holding a name before anything is sent", async () => {
    const result = await speech("fon", "fon", "Bulletin de Sènami : moyenne 13,5.", 3, { kind: "free", userId: "u1" });
    expect(result).toEqual({ ok: false, reason: "private" });
    expect(spoken).toEqual([]);
    expect(sent.join("\n")).not.toMatch(NAME);
  });
});

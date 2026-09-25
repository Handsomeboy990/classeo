import { describe, expect, it, vi } from "vitest";

import { absoluteUrl, appUrl, DEFAULT_FROM, maskAddress, readMailConfig } from "./config";
import { createMailer, type MailMessage, type TransportLike, type TransportOptions } from "./transport";

const message: MailMessage = {
  to: "secretaire@classeo.bj",
  subject: "Votre compte Classéo est prêt",
  html: "<p>Mot de passe temporaire : Xk7pQ2mRta9w</p>",
  text: "Mot de passe temporaire : Xk7pQ2mRta9w",
  tag: "account_created",
};

function logger() {
  const lines: string[] = [];
  return { lines, info: (m: string) => lines.push(m), error: (m: string) => lines.push(m) };
}

describe("readMailConfig", () => {
  it("disables mail when SMTP_HOST is missing or blank", () => {
    expect(readMailConfig({})).toEqual({ enabled: false, from: DEFAULT_FROM });
    expect(readMailConfig({ SMTP_HOST: "  ", SMTP_PORT: "1025" }).enabled).toBe(false);
  });
  it("reads a local Mailpit setup", () => {
    expect(readMailConfig({ SMTP_HOST: "localhost", SMTP_PORT: "1025" })).toEqual({
      enabled: true,
      from: DEFAULT_FROM,
      host: "localhost",
      port: 1025,
      secure: false,
      user: null,
      password: null,
    });
  });
  it("uses implicit TLS on 465 unless told otherwise, and falls back to 587 on a bad port", () => {
    expect(readMailConfig({ SMTP_HOST: "smtp.example.bj", SMTP_PORT: "465" })).toMatchObject({ port: 465, secure: true });
    expect(readMailConfig({ SMTP_HOST: "smtp.example.bj", SMTP_PORT: "465", SMTP_SECURE: "false" })).toMatchObject({ secure: false });
    expect(readMailConfig({ SMTP_HOST: "smtp.example.bj", SMTP_PORT: "abc" })).toMatchObject({ port: 587, secure: false });
    expect(readMailConfig({ SMTP_HOST: "smtp.example.bj", SMTP_PORT: "587", SMTP_SECURE: "TRUE" })).toMatchObject({ secure: true });
  });
  it("keeps credentials only together with a user, and honours MAIL_FROM", () => {
    expect(readMailConfig({ SMTP_HOST: "h", SMTP_PASSWORD: "secret" })).toMatchObject({ user: null, password: null });
    expect(readMailConfig({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASSWORD: "secret", MAIL_FROM: "Classéo <x@y.bj>" })).toMatchObject({ user: "u", password: "secret", from: "Classéo <x@y.bj>" });
  });
});

describe("appUrl and absoluteUrl", () => {
  it("prefers APP_URL, then the Vercel address, then localhost", () => {
    expect(appUrl({ APP_URL: "https://classeo.gouv.bj/" })).toBe("https://classeo.gouv.bj");
    expect(appUrl({ APP_URL: "classeo.gouv.bj", VERCEL_URL: "classeo.vercel.app" })).toBe("https://classeo.vercel.app");
    expect(appUrl({})).toBe("http://localhost:3000");
  });
  it("only joins same site paths", () => {
    expect(absoluteUrl("https://a.bj", "/espace/messages/1")).toBe("https://a.bj/espace/messages/1");
    expect(absoluteUrl("https://a.bj", "//evil.example")).toBe("https://a.bj/espace");
    expect(absoluteUrl("https://a.bj", "/\\evil.example")).toBe("https://a.bj/espace");
    expect(absoluteUrl("https://a.bj", "https://evil.example")).toBe("https://a.bj/espace");
    expect(absoluteUrl("https://a.bj", undefined)).toBe("https://a.bj/espace");
  });
  it("masks addresses for the log", () => {
    expect(maskAddress("secretaire@classeo.bj")).toBe("se***@classeo.bj");
    expect(maskAddress("a@b.bj")).toBe("a***@b.bj");
    expect(maskAddress("nonsense")).toBe("***");
  });
});

describe("createMailer", () => {
  it("without SMTP_HOST, logs a summary without the body and sends nothing", async () => {
    const log = logger();
    const createTransport = vi.fn();
    const mailer = createMailer({ config: readMailConfig({ SMTP_PASSWORD: "hunter2hunter2" }), createTransport, logger: log });
    expect(await mailer.send(message)).toBe("skipped");
    expect(createTransport).not.toHaveBeenCalled();
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toContain("account_created");
    expect(log.lines[0]).toContain("se***@classeo.bj");
    expect(log.lines[0]).not.toContain("Xk7pQ2mRta9w");
    expect(log.lines[0]).not.toContain("secretaire@");
    expect(log.lines[0]).not.toContain("hunter2");
  });

  it("sends through one reused transport with timeouts and the configured sender", async () => {
    const sendMail = vi.fn(async () => ({}));
    const createTransport = vi.fn((options: TransportOptions): TransportLike => { void options; return { sendMail }; });
    const log = logger();
    const config = readMailConfig({ SMTP_HOST: "localhost", SMTP_PORT: "1025", SMTP_USER: "u", SMTP_PASSWORD: "hunter2hunter2", MAIL_FROM: "Classéo <no-reply@classeo.bj>" });
    const mailer = createMailer({ config, createTransport, logger: log });
    expect(await mailer.send(message)).toBe("sent");
    expect(await mailer.send(message)).toBe("sent");
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0]![0]).toMatchObject({
      host: "localhost",
      port: 1025,
      secure: false,
      auth: { user: "u", pass: "hunter2hunter2" },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });
    expect(sendMail).toHaveBeenCalledWith({ from: "Classéo <no-reply@classeo.bj>", to: message.to, subject: message.subject, html: message.html, text: message.text });
    expect(log.lines.join("\n")).not.toContain("hunter2");
  });

  it("never throws when the server refuses or does not answer", async () => {
    const log = logger();
    const refusing = createMailer({
      config: readMailConfig({ SMTP_HOST: "localhost" }),
      createTransport: () => ({ sendMail: async () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:587")) }),
      logger: log,
    });
    expect(await refusing.send(message)).toBe("failed");
    expect(log.lines[0]).toContain("ECONNREFUSED");
    expect(log.lines[0]).not.toContain("Xk7pQ2mRta9w");

    const silent = createMailer({
      config: readMailConfig({ SMTP_HOST: "localhost" }),
      createTransport: () => ({ sendMail: () => new Promise(() => {}) }),
      logger: logger(),
      timeoutMs: 20,
    });
    expect(await silent.send(message)).toBe("failed");

    const broken = createMailer({
      config: readMailConfig({ SMTP_HOST: "localhost" }),
      createTransport: () => {
        throw new Error("bad options");
      },
      logger: logger(),
    });
    expect(await broken.send(message)).toBe("failed");
  });
});

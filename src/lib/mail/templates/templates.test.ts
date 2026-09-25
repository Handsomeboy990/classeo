import { describe, expect, it } from "vitest";

import { credentialsEmail, escapeHtml, notificationEmail, passwordChangedEmail, resetCodeEmail } from ".";

const credentials = {
  reason: "created" as const,
  firstName: "Pélagie",
  email: "p.tossou@classeo.bj",
  roleName: "Secrétaire",
  scopeLabel: "Établissement CEG Godomey",
  by: { name: "Adjoa Houngbédji", roleName: "Administrateur national" },
  password: "Xk7pQ2mRta9w",
  signInUrl: "https://classeo.gouv.bj/connexion",
};

describe("e-mail templates", () => {
  it("escapes every value", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    const mail = notificationEmail({ firstName: "<b>", kind: "message", title: "Nouveau <script>", body: "a & b", url: "https://a.bj/espace" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Nouveau &lt;script&gt;");
    expect(mail.html).toContain("a &amp; b");
  });

  it("never renders a non web link", () => {
    const mail = notificationEmail({ firstName: "A", kind: "absence", title: "T", body: "B", url: "javascript:alert(1)" });
    expect(mail.html).not.toContain('href="javascript:');
  });

  it("gives the account e-mail everything needed to sign in, in both versions", () => {
    const mail = credentialsEmail(credentials);
    expect(mail.subject).toBe("Votre compte Classéo est prêt");
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("Xk7pQ2mRta9w");
      expect(part).toContain("p.tossou@classeo.bj");
      expect(part).toContain("Secrétaire");
      expect(part).toContain("CEG Godomey");
      expect(part).toContain("Adjoa Houngbédji");
      expect(part).toContain("https://classeo.gouv.bj/connexion");
      expect(part).toContain("première connexion");
    }
    expect(credentialsEmail({ ...credentials, reason: "reset" }).subject).toBe("Votre mot de passe Classéo a été réinitialisé");
  });

  it("states the code rules in the reset e-mail, without the code in the subject", () => {
    const mail = resetCodeEmail({ firstName: "Pélagie", code: "048213", minutes: 15, maxAttempts: 5, codeUrl: "https://a.bj/mot-de-passe-oublie/code" });
    expect(mail.subject).not.toContain("048213");
    expect(mail.text).toContain("048213");
    expect(mail.text).toContain("15 minutes");
    expect(mail.text).toContain("5 essais");
  });

  it("dates the password change in Benin time", () => {
    const mail = passwordChangedEmail({ firstName: "P", email: "p@a.bj", at: new Date("2026-09-25T10:30:00Z"), signInUrl: "https://a.bj/connexion", forgotUrl: "https://a.bj/mot-de-passe-oublie" });
    expect(mail.text).toContain("25 septembre 2026");
    expect(mail.text).toContain("11:30");
  });

  it("uses no em dash anywhere", () => {
    const all = [credentialsEmail(credentials), resetCodeEmail({ firstName: "A", code: "1", minutes: 15, maxAttempts: 5, codeUrl: "https://a" })];
    for (const m of all) expect(m.html + m.text).not.toContain(String.fromCharCode(0x2014));
  });
});

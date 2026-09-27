import { expect, test } from "./support/fixtures";

// Journey 10: the security headers are sent with the sign in page.
test("security headers are present on /connexion", async ({ request }) => {
  const response = await request.get("/connexion");
  expect(response.status()).toBe(200);
  const headers = response.headers();

  const csp = headers["content-security-policy"];
  expect(csp).toBeTruthy();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("unsafe-eval");

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");

  // The strict policy of the pages, with a nonce (report only by default).
  const strict = headers["content-security-policy-report-only"] ?? headers["content-security-policy"];
  expect(strict).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
});

// The strict policy is meant to be enforced once clean: the pages break none
// of its rules, signed out and signed in.
test("pages break no rule of the strict content security policy", async ({ pageAs }) => {
  const page = await pageAs("ministre");
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (e) => seen.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  for (const path of ["/", "/connexion?lang=fon", "/credits", "/verifier", "/espace", "/espace/statistiques/connexions", "/espace/eleves", "/page-inconnue"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    expect(violations, path).toEqual([]);
  }
});

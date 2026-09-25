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
});

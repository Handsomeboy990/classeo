import { authFile } from "./support/accounts";
import { expect, expectForbidden, test, uniqueSuffix } from "./support/fixtures";

// Parent payments, electronic signatures and the public check of documents.
// Relies on prisma/seed-extras/payments-signatures.ts: the payment accounts
// of CEG Godomey, Sènami's invoice with declarations, and the head's
// signature and stamp.

test.describe.configure({ mode: "serial" });

// Each run confirms a declaration of 1 FCFA on Sènami's invoice: the seeded
// balance leaves room for many runs before the invoice is covered.

test("a parent declares a transfer once, the accountant confirms it", async ({ pageAs }) => {
  const parent = await pageAs("parent");
  await parent.goto("/espace/payer");
  await expect(parent.getByRole("heading", { level: 1, name: "Payer les frais" })).toBeVisible();
  await parent.getByRole("link", { name: "Sènami Hounkpatin" }).click();
  await expect(parent.getByRole("heading", { level: 1, name: "Frais de Sènami" })).toBeVisible();
  await expect(parent.getByText("01 97 00 12 34", { exact: true })).toBeVisible();
  await expect(parent.getByText("Non retrouvé").first()).toBeVisible();

  const ref = `MP${uniqueSuffix().replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
  const form = parent.locator("form", { has: parent.getByRole("button", { name: "Déclarer ce paiement" }) });
  await form.getByLabel("Montant payé").fill("1");
  await form.getByLabel(/Référence de la transaction/).fill(ref);
  await form.getByRole("button", { name: "Déclarer ce paiement" }).click();
  await expect(parent.getByText("Paiement déclaré.", { exact: false }).first()).toBeVisible();
  await expect(parent.getByText(`réf. ${ref}`, { exact: false })).toBeVisible();

  // The same reference cannot be declared twice.
  await form.getByLabel("Montant payé").fill("1");
  await form.getByLabel(/Référence de la transaction/).fill(ref.toLowerCase());
  await form.getByRole("button", { name: "Déclarer ce paiement" }).click();
  await expect(parent.getByText("Cette référence a déjà été déclarée", { exact: false }).first()).toBeVisible();

  const accountant = await pageAs("comptable");
  await accountant.goto("/espace/frais/declarations");
  await expect(accountant.getByRole("heading", { level: 1, name: "Paiements des parents" })).toBeVisible();
  const row = accountant.getByRole("listitem").filter({ hasText: ref });
  await row.getByRole("button", { name: "Confirmer" }).click();
  await accountant.getByRole("dialog").getByRole("button", { name: "Confirmer le paiement" }).click();
  await expect(accountant.getByText("enregistré, le parent est prévenu", { exact: false }).first()).toBeVisible();
  await expect(accountant.getByRole("listitem").filter({ hasText: ref }).getByText("Confirmé")).toBeVisible();
});

test("the head signs an attestation and anyone can check it", async ({ pageAs, page }) => {
  const head = await pageAs("directeur");
  await head.goto("/espace/signature");
  await expect(head.getByRole("heading", { level: 1, name: "Signature électronique" })).toBeVisible();
  await expect(head.getByText("Signature prête")).toBeVisible();

  await head.goto("/espace/signature/documents?q=S%C3%A8nami+Hounkpatin");
  const pupil = head.getByRole("listitem").filter({ hasText: "Hounkpatin Sènami" });
  const signed = pupil.getByRole("link", { name: /^[0-9A-Z]{5}-[0-9A-Z]{5}$/ }).first();
  if (!(await signed.count())) {
    await pupil.getByRole("button", { name: "Signer l'attestation" }).click();
    await head.getByRole("dialog").getByRole("button", { name: "Signer", exact: true }).click();
    await expect(head.getByText("Code de vérification", { exact: false }).first()).toBeVisible();
  }
  const code = (await pupil.getByRole("link", { name: /^[0-9A-Z]{5}-[0-9A-Z]{5}$/ }).first().textContent())!.trim();

  // The PDF downloaded by the parent is the signed copy.
  const parent = await pageAs("parent");
  const pdf = await parent.request.get(`/api/pdf/attestation/${await studentId(head)}`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Public check, without an account.
  await page.goto(`/verifier/${code}`);
  await expect(page.getByText("Document authentique")).toBeVisible();
  await expect(page.getByText("Attestation de scolarité")).toBeVisible();
  await expect(page.getByText("S. H.")).toBeVisible();
  await expect(page.getByText("Signé électroniquement par", { exact: false })).toBeVisible();
  await expect(page.getByText("Hounkpatin")).toHaveCount(0);

  await page.goto("/verifier/ZZZZZ-ZZZZZ");
  await expect(page.getByText("Code inconnu")).toBeVisible();
});

async function studentId(head: import("@playwright/test").Page) {
  const link = head.getByRole("link", { name: /PDF, attestation de Hounkpatin Sènami/ });
  const href = (await link.getAttribute("href"))!;
  return href.split("/").pop()!;
}

test("every PDF gets a verification code in the register", async ({ pageAs }) => {
  const accountant = await pageAs("comptable");
  await accountant.goto("/espace/frais/factures");
  const first = accountant.getByRole("link", { name: /^FAC-\d{4}-\d{4}$/ }).first();
  await first.click();
  const href = (await accountant.getByRole("link", { name: /Télécharger en PDF, facture/ }).getAttribute("href"))!;
  const res = await accountant.request.get(href);
  expect(res.status()).toBe(200);

  await accountant.goto("/espace/signature/registre?type=facture");
  const code = accountant.getByRole("link", { name: /^[0-9A-Z]{5}-[0-9A-Z]{5}$/ }).first();
  await expect(code).toBeVisible();
  await code.click();
  await expect(accountant.getByText("Document authentique")).toBeVisible();
  await expect(accountant.getByText("Comparer avec le fichier PDF", { exact: false })).toBeVisible();
});

test("the payment webhook refuses an unsigned call", async ({ request }) => {
  const res = await request.post("/api/paiements/fedapay/webhook", { data: { name: "transaction.approved", entity: { id: 1, status: "approved", amount: 1 } } });
  expect(res.status()).toBe(400);
});

test.describe("secretary", () => {
  test.use({ storageState: authFile("secretaire") });

  test("cannot open the parent payment pages", async ({ page }) => {
    const response = await page.goto("/espace/payer");
    expect(response?.status()).toBe(403);
    await expectForbidden(page);
  });
});

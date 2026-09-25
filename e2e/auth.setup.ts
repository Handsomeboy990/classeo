import { ACCOUNTS, authFile, ROLES } from "./support/accounts";
import { expect, signIn, test as setup } from "./support/fixtures";

// Journey 1, first half: every role signs in through the form and lands on
// its dashboard. One sign in per role and per run; the saved session is
// reused by every other test.
for (const role of ROLES) {
  setup(`sign in as ${role} lands on /espace`, async ({ page }) => {
    await signIn(page, ACCOUNTS[role]);
    await expect(page).toHaveURL(/\/espace$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Signed in: the account menu of the top bar names the person.
    await expect(page.getByRole("button", { name: /^Mon compte/ })).toBeVisible();
    await page.context().storageState({ path: authFile(role) });
  });
}

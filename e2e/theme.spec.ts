import { authFile } from "./support/accounts";
import { expect, test } from "./support/fixtures";

// The official look is light on every device, as on the State sites: a
// phone or computer set to a dark colour scheme still gets the light theme.
// The dark theme only applies when chosen in the accessibility panel.

const LIGHT_BG = "rgb(244, 246, 250)";

test.describe("light theme whatever the system colour scheme", () => {
  test.use({ colorScheme: "dark" });

  test("a public page stays light @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BG);
  });

  test.describe("signed in", () => {
    test.use({ storageState: authFile("directeur") });

    test("the private space stays light, and the panel offers no automatic theme", async ({ page }) => {
      await page.goto("/espace");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BG);
      await page.getByRole("button", { name: "Réglages d'accessibilité" }).click();
      const theme = page.locator("#a11y-panel").getByRole("group", { name: "Thème" });
      await expect(theme.getByRole("radio", { name: "Clair" })).toBeChecked();
      await expect(theme.getByRole("radio", { name: "Automatique" })).toHaveCount(0);
    });
  });

  test("an older automatic choice saved on the device reads as light", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("classeo:theme", "system"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("the dark theme applies once chosen", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("classeo:theme", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

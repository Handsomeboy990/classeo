import { authFile } from "./support/accounts";
import { expect, expectForbidden, test } from "./support/fixtures";

// Journey 2: statistics follow the territorial scope of the account.
test.describe("departmental director of Atlantique", () => {
  test.use({ storageState: authFile("ddemp") });

  test("sees Atlantique in statistics", async ({ page }) => {
    await page.goto("/espace/statistiques");
    await expect(page.getByRole("heading", { level: 1, name: "Statistiques" })).toBeVisible();

    const crumbs = page.getByRole("navigation", { name: "Fil d'Ariane territorial" });
    await expect(crumbs.getByText("Atlantique")).toHaveAttribute("aria-current", "page");
    // The country level is above the director: shown, not reachable.
    await expect(crumbs.getByRole("link", { name: "Bénin" })).toHaveCount(0);

    // The comparison lists the communes of Atlantique and no other.
    const table = page.getByRole("table", { name: /Indicateurs par commune/ });
    await expect(table.getByRole("rowheader", { name: "Abomey-Calavi", exact: true })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Ouidah", exact: true })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Cotonou", exact: true })).toHaveCount(0);
  });

  test("gets the 403 page on another department", async ({ page, pageAs }) => {
    // The id of Littoral comes from the minister's view, as a curious
    // director would find it in a shared link.
    const minister = await pageAs("ministre");
    await minister.goto("/espace/territoire");
    const littoralHref = await minister
      .getByRole("table", { name: /Indicateurs par département/ })
      .getByRole("link", { name: "Littoral", exact: true })
      .getAttribute("href");
    expect(littoralHref).toMatch(/^\/espace\/territoire\/[\w-]+$/);

    await page.goto(littoralHref!);
    await expectForbidden(page);
    await expect(page.getByText("Département Littoral")).toHaveCount(0);

    // His own department still opens.
    await page.goto("/espace/territoire");
    await expect(page.getByRole("heading", { level: 1, name: "Département Atlantique" })).toBeVisible();
  });
});

test.describe("minister", () => {
  test.use({ storageState: authFile("ministre") });

  test("drills down Bénin > Atlantique > Abomey-Calavi", async ({ page }) => {
    await page.goto("/espace/territoire");
    await expect(page.getByRole("heading", { level: 1, name: "Territoire national" })).toBeVisible();

    await page.getByRole("table", { name: /Indicateurs par département/ }).getByRole("link", { name: "Atlantique", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Département Atlantique" })).toBeVisible();

    await page.getByRole("table", { name: /Indicateurs par commune/ }).getByRole("link", { name: "Abomey-Calavi", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Commune d’Abomey-Calavi" })).toBeVisible();

    const crumbs = page.getByRole("navigation", { name: "Fil d'Ariane territorial" });
    await expect(crumbs.getByRole("link", { name: "Bénin" })).toBeVisible();
    await expect(crumbs.getByRole("link", { name: "Atlantique" })).toBeVisible();
    await expect(crumbs.getByText("Abomey-Calavi")).toHaveAttribute("aria-current", "page");

    // The schools of the commune, including the demonstration college.
    await expect(page.getByRole("table", { name: /Indicateurs par établissement/ }).getByRole("link", { name: "CEG Godomey", exact: true })).toBeVisible();

    // And back up through the breadcrumb.
    await crumbs.getByRole("link", { name: "Bénin" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Territoire national" })).toBeVisible();
  });
});

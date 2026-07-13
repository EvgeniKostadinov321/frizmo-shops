import { expect, test, type Page } from "@playwright/test";

/* Глобален купувачески профил: регистрация с роля „купувач" → глобален /account
   с табове; сърце „любим магазин" от storefront хедъра → показва се в профила.
   Ползва демо магазина atelie-glina (seed-demo-shops.mjs). */

async function markCookieSeen(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
}

async function registerBuyer(page: Page, email: string) {
  await markCookieSeen(page);
  await page.goto("/auth/register?role=buyer");
  await page.getByLabel("Име и фамилия").fill("Е2Е Глобал");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  /* Купувач без next → глобален /account. */
  await expect(page).toHaveURL(/\/account/);
}

test("купувач → глобален профил с табове", async ({ page }) => {
  test.setTimeout(120_000);
  await registerBuyer(page, `frizmo.e2e+glob${Date.now()}@gmail.com`);
  await expect(page.getByRole("heading", { name: /Здравей/ })).toBeVisible();
  await page.getByRole("link", { name: "Любими", exact: true }).click();
  await expect(page.getByRole("button", { name: /Продукти/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Магазини/ })).toBeVisible();
});

test("любим магазин от storefront хедъра → показва се в профила", async ({ page }) => {
  test.setTimeout(120_000);
  await registerBuyer(page, `frizmo.e2e+favshop${Date.now()}@gmail.com`);
  await page.goto("/s/atelie-glina");
  await page.getByRole("button", { name: "Добави в любими магазини" }).click();
  /* Изчакай server action-а да приключи (иначе goto прекъсва POST-а):
     бутонът флипва на „Премахни" и се re-enable-ва след като busy падне. */
  const removeBtn = page.getByRole("button", { name: "Премахни от любими магазини" });
  await expect(removeBtn).toBeVisible();
  await expect(removeBtn).toBeEnabled();
  await page.goto("/account/favorites");
  await page.getByRole("button", { name: /Магазини/ }).click();
  /* Демо магазинът трябва да се появи в таба. */
  await expect(page.getByText("Ателие Глина")).toBeVisible();
});

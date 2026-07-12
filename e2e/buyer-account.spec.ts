import { expect, test, type Page } from "@playwright/test";

/* Купувачески профил: регистрация с роля „купувач" → профил → адрес CRUD.
   Ползва демо магазина atelie-glina (seed-demo-shops.mjs). */

async function markCookieSeen(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
}

async function registerBuyer(page: Page, email: string) {
  await markCookieSeen(page);
  await page.goto("/auth/register?role=buyer");
  /* Toggle-ът показва „Пазарувам" като активна роля. */
  await expect(page.getByRole("link", { name: "Пазарувам" })).toBeVisible();
  await page.getByLabel("Име и фамилия").fill("Е2Е Купувач");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  /* Купувач без магазин и без next → каталог /shops (не dashboard). */
  await expect(page).toHaveURL(/\/shops/);
}

test("регистрация като купувач → профил е достъпен", async ({ page }) => {
  test.setTimeout(120_000);
  await registerBuyer(page, `frizmo.e2e+buyer${Date.now()}@gmail.com`);

  /* Профилът живее в контекста на магазин. */
  await page.goto("/s/atelie-glina/account");
  await expect(page.getByRole("heading", { name: /Здравей/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Поръчки", exact: true })).toBeVisible();
});

test("адрес CRUD в профила", async ({ page }) => {
  test.setTimeout(120_000);
  await registerBuyer(page, `frizmo.e2e+addr${Date.now()}@gmail.com`);

  await page.goto("/s/atelie-glina/account/addresses");
  await expect(page.getByText("Още нямаш запазени адреси.")).toBeVisible();

  /* Добавяне през drawer. */
  await page.getByRole("button", { name: "Добави адрес" }).click();
  await page.getByLabel("Име на получателя").fill("Иван Иванов");
  await page.getByLabel("Телефон").fill("0888123456");
  await page.getByLabel("Град").fill("София");
  await page.getByLabel("Адрес", { exact: true }).fill("ул. Тестова 1");
  await page.getByRole("button", { name: "Запази" }).click();

  await expect(page.getByText("ул. Тестова 1, София")).toBeVisible();

  /* Изтриване: бутонът в картата отваря ConfirmDialog → потвърждаваме в него. */
  await page.getByRole("button", { name: "Изтрий" }).click();
  const dialog = page.getByRole("dialog", { name: "Изтриване на адрес" });
  await dialog.getByRole("button", { name: "Изтрий" }).click();
  await expect(page.getByText("Още нямаш запазени адреси.")).toBeVisible();
});

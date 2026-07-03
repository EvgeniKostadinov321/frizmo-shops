import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, email: string) {
  /* Cookie банерът покрива бутони — маркираме го като видян */
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
  await page.goto("/auth/register");
  await page.getByLabel("Име и фамилия").fill("Е2Е Админ Тест");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Регистрира акаунта или влиза, ако вече съществува (идемпотентно за повторни run-ове). */
async function registerOrLogin(page: Page, email: string) {
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
  await page.goto("/auth/register");
  await page.getByLabel("Име и фамилия").fill("Е2Е Админ");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();

  const taken = page.getByText(/вече да е зает/);
  const outcome = await Promise.race([
    page
      .waitForURL(/\/dashboard/, { timeout: 30_000 })
      .then(() => "registered" as const)
      .catch(() => null),
    taken
      .waitFor({ timeout: 30_000 })
      .then(() => "taken" as const)
      .catch(() => null),
  ]);

  if (outcome === "taken") {
    await page.goto("/auth/login");
    await page.getByLabel("Имейл").fill(email);
    await page.getByLabel("Парола").fill("parola123!");
    await page.getByRole("button", { name: "Влез" }).click();
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/* Админ имейлът е в PLATFORM_ADMIN_EMAILS (.env.local) */
const ADMIN_EMAIL = "frizmo.e2e.admin@gmail.com";

test.describe("Платформен админ", () => {
  test("обикновен потребител получава 404 на /admin", async ({ page }) => {
    await register(page, `frizmo.e2e+notadmin${Date.now()}@gmail.com`);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Страницата не е намерена" }),
    ).toBeVisible();
  });

  test("админът вижда панела, скрива и възстановява магазин", async ({ page, browser }) => {
    test.setTimeout(180_000);

    /* Търговец с публикуван магазин */
    const merchantContext = await browser.newContext();
    const merchant = await merchantContext.newPage();
    const stamp = Date.now();
    await register(merchant, `frizmo.e2e+victim${stamp}@gmail.com`);
    await merchant.getByRole("link", { name: "Създай магазин" }).click();
    await merchant.getByLabel("Име на магазина").fill(`Магазин за скриване ${stamp}`);
    await merchant.getByLabel("Категория на бизнеса").selectOption("Друго");
    await merchant.getByRole("button", { name: "Създай магазина" }).click();
    await merchant.getByLabel("Име на продукта").fill("Продукт");
    await merchant.getByLabel("Цена", { exact: true }).fill("10");
    await merchant.getByRole("button", { name: "Създай продукта" }).click();
    await expect(merchant.getByRole("heading", { name: "Табло" })).toBeVisible();
    await merchant.getByRole("link", { name: "Уебсайт" }).click();
    const publicUrl = await merchant
      .getByRole("link", { name: "Отвори сайта ↗" })
      .getAttribute("href");
    await merchant.getByRole("button", { name: "Публикувай" }).click();
    await expect(merchant.getByText("Магазинът е публикуван! 🎉")).toBeVisible();
    await merchantContext.close();

    /* Админ: регистрира се първия път или влиза */
    await registerOrLogin(page, ADMIN_EMAIL);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Платформен админ" })).toBeVisible();

    /* Намира магазина и го скрива */
    const row = page.getByRole("row", { name: new RegExp(`Магазин за скриване ${stamp}`) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Скрий" }).click();
    await expect(row.getByText("Скрит")).toBeVisible();

    /* Публично: 404 */
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(publicUrl!);
    await expect(
      anonPage.getByRole("heading", { name: "Страницата не е намерена" }),
    ).toBeVisible();
    await anon.close();

    /* Възстановяване */
    await row.getByRole("button", { name: "Възстанови" }).click();
    await expect(row.getByText("Публикуван")).toBeVisible();
  });
});

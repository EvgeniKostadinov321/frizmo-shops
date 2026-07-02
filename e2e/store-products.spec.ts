import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, email: string) {
  await page.goto("/auth/register");
  await page.getByLabel("Име и фамилия").fill("Е2Е Търговец");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Магазин и продукти", () => {
  test("onboarding → категории → продукт с варианти → редакция", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page, `frizmo.e2e+shop${Date.now()}@gmail.com`);

    /* 1. Onboarding стъпка 1 */
    await page.getByRole("link", { name: "Създай магазин" }).click();
    await expect(page.getByRole("heading", { name: "Да създадем магазина ти" })).toBeVisible();
    await page.getByLabel("Име на магазина").fill("Е2Е Ферма");
    await page.getByLabel("Категория на бизнеса").selectOption("Храни и напитки");
    await page.getByText("Още детайли").click();
    await page.getByLabel("Град").fill("Пловдив");
    await page.getByRole("button", { name: "Създай магазина" }).click();

    /* 2. Стъпка 2 → прескачаме */
    await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();
    await page.getByRole("link", { name: "Прескочи засега" }).click();
    await expect(page.getByRole("heading", { name: "Табло" })).toBeVisible();

    /* 3. Категории: Млечни → Сирена (подкатегория) */
    await page.getByRole("link", { name: "Категории" }).click();
    await page.getByRole("button", { name: "Добави категория" }).first().click();
    await page.getByLabel("Име").fill("Млечни");
    await page.getByRole("button", { name: "Запази" }).click();
    await expect(page.getByText("Млечни")).toBeVisible();

    await page.getByRole("button", { name: "Добави категория" }).click();
    await page.getByLabel("Име").fill("Сирена");
    await page.getByLabel("Родителска категория").selectOption({ label: "Млечни" });
    await page.getByRole("button", { name: "Запази" }).click();
    await expect(page.getByText("Сирена")).toBeVisible();

    /* 4. Нов продукт с снимка, опция и per-вариант цена */
    await page.getByRole("link", { name: "Продукти", exact: true }).click();
    await page.getByRole("link", { name: "Нов продукт" }).click();

    await page.getByLabel("Име на продукта").fill("Краве сирене");
    await page.getByLabel("Категория", { exact: true }).selectOption({ label: "Млечни → Сирена" });
    await page.getByLabel("Цена", { exact: true }).fill("12,50");

    await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/product.png");
    await expect(page.getByText("Корица")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "+ Добави опция" }).click();
    await page.getByPlaceholder("Име на опцията (напр. Размер)").fill("Разфасовка");
    const valueInput = page.getByPlaceholder("Напиши стойност и натисни Enter (напр. M)");
    await valueInput.fill("500г");
    await valueInput.press("Enter");
    await valueInput.fill("1кг");
    await valueInput.press("Enter");

    await expect(page.getByRole("cell", { name: "500г", exact: true })).toBeVisible();
    await page.getByLabel("Цена за 1кг").fill("23");

    await page.getByRole("button", { name: "Създай продукта" }).click();
    await expect(page).toHaveURL(/\/dashboard\/products$/);
    await expect(page.getByText("Краве сирене")).toBeVisible();
    await expect(page.getByText("12,50")).toBeVisible();

    /* 5. Редакция: вариантната цена е запазена */
    await page.getByRole("link", { name: /Краве сирене/ }).click();
    await expect(page.getByRole("heading", { name: /Редакция/ })).toBeVisible();
    await expect(page.getByLabel("Цена за 1кг")).toHaveValue("23,00");
  });

  test("чужд потребител няма достъп до чужди продукти", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();

    /* Първи търговец с магазин и продукт */
    await register(page, `frizmo.e2e+owner${stamp}@gmail.com`);
    await page.getByRole("link", { name: "Създай магазин" }).click();
    await page.getByLabel("Име на магазина").fill("Магазин на собственика");
    await page.getByLabel("Категория на бизнеса").selectOption("Друго");
    await page.getByRole("button", { name: "Създай магазина" }).click();
    await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();

    await page.getByLabel("Име на продукта").fill("Таен продукт");
    await page.getByLabel("Цена", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Създай продукта" }).click();
    await expect(page.getByRole("heading", { name: "Табло" })).toBeVisible();

    await page.getByRole("link", { name: "Продукти", exact: true }).click();
    await page.getByRole("link", { name: /Таен продукт/ }).click();
    await expect(page.getByRole("heading", { name: /Редакция/ })).toBeVisible();
    const productUrl = page.url();

    /* Втори търговец (със собствен магазин) в отделна сесия опитва същия URL */
    const context = await browser.newContext();
    const intruder = await context.newPage();
    await register(intruder, `frizmo.e2e+intruder${stamp}@gmail.com`);
    await intruder.getByRole("link", { name: "Създай магазин" }).click();
    await intruder.getByLabel("Име на магазина").fill("Магазин на натрапника");
    await intruder.getByLabel("Категория на бизнеса").selectOption("Друго");
    await intruder.getByRole("button", { name: "Създай магазина" }).click();
    await expect(
      intruder.getByRole("heading", { name: "Добави първия си продукт" }),
    ).toBeVisible();

    await intruder.goto(productUrl);
    await expect(intruder.getByRole("heading", { name: "404" })).toBeVisible();
    await context.close();
  });
});

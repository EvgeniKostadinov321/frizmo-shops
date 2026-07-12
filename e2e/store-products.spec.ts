import { expect, test, type Page } from "@playwright/test";
import { selectOption } from "./helpers";

async function register(page: Page, email: string) {
  /* Cookie банерът покрива бутони — маркираме го като видян */
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
  await page.goto("/auth/register");
  await page.getByLabel("Име и фамилия").fill("Е2Е Търговец");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Минава през onboarding wizard-а (Основно → Контакти → Работно време) с
    минимума задължителни полета и създава магазина. */
async function createShopViaWizard(page: Page, name: string, category: string) {
  await page.getByRole("link", { name: "Създай магазин" }).click();
  await page.getByLabel("Име на магазина").fill(name);
  await selectOption(page, "Категория на бизнеса", category);
  /* Стъпка 1 → 2 → 3, изчаквайки индикатора да маркира всяка под-стъпка, преди
     да продължим (бутонът „Напред"→„Създай магазина" се сменя при смяна на
     стъпка — чакаме стабилно състояние, за да не уцелим бутона по време на
     re-render). */
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Контакти" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Работно време" })).toHaveAttribute(
    "data-active",
    "true",
  );
  /* Ф2: 4-та стъпка „Сложност" */
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Сложност" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Създай магазина" }).click();
  await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();
}

test.describe("Магазин и продукти", () => {
  test("onboarding → категории → продукт с варианти → редакция", async ({ page }) => {
    test.setTimeout(240_000);
    await register(page, `frizmo.e2e+shop${Date.now()}@gmail.com`);

    /* 1. Onboarding wizard: стъпка „Основно" → „Контакти" (град) → „Работно време" */
    await page.getByRole("link", { name: "Създай магазин" }).click();
    await expect(page.getByRole("heading", { name: "Да създадем магазина ти" })).toBeVisible();
    await page.getByLabel("Име на магазина").fill("Е2Е Ферма");
    await selectOption(page, "Категория на бизнеса", "Храни и напитки");
    /* Стъпка „Основно" → „Контакти": изчакваме индикатора да маркира стъпка 2 */
    await page.getByRole("button", { name: "Напред" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Контакти" })).toHaveAttribute(
      "data-active",
      "true",
    );
    await page.getByLabel("Град").fill("Пловдив");
    /* „Контакти" → „Работно време": чакаме индикатора */
    await page.getByRole("button", { name: "Напред" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Работно време" }),
    ).toHaveAttribute("data-active", "true");
    /* Ф2: 4-та стъпка „Сложност" — избираме „Пълна настройка" (тестът ползва
       варианти, които са само в пълен режим). */
    await page.getByRole("button", { name: "Напред" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Сложност" }),
    ).toHaveAttribute("data-active", "true");
    await page.getByRole("button", { name: /Пълна настройка/ }).click();
    await page.getByRole("button", { name: "Създай магазина" }).click();

    /* 2. Стъпка 2 → прескачаме */
    await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();
    await page.getByRole("link", { name: "Прескочи засега" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    /* 3. Категории: Млечни → Сирена (подкатегория) */
    await page.getByRole("link", { name: "Категории" }).click();
    await page.getByRole("button", { name: "Добави категория" }).first().click();
    await page.getByLabel("Име").fill("Млечни");
    await page.getByRole("button", { name: "Запази" }).click();
    await expect(page.getByText("Млечни")).toBeVisible();

    await page.getByRole("button", { name: "Добави категория" }).click();
    await page.getByLabel("Име").fill("Сирена");
    /* Изчакваме router.refresh() да достави новата категория в опциите на custom
       Select-а, после избираме „Млечни" за родител. */
    await page.getByLabel("Родителска категория", { exact: true }).click();
    const parentList = page.getByRole("listbox", { name: "Родителска категория" });
    await expect(parentList.getByRole("option", { name: "Млечни", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await parentList.getByRole("option", { name: "Млечни", exact: true }).click();
    await page.getByRole("button", { name: "Запази" }).click();
    await expect(page.getByText("Сирена")).toBeVisible();

    /* 4. Нов продукт с снимка, опция и per-вариант цена */
    await page.getByRole("link", { name: "Продукти", exact: true }).click();
    await page.getByRole("link", { name: "Нов продукт" }).click();

    await page.getByLabel("Име на продукта").fill("Краве сирене");
    await selectOption(page, "Категория", "Млечни → Сирена");
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
    /* Списъкът има мобилен (скрит на десктоп) и таблетен изглед → таблицата */
    await expect(page.getByRole("table").getByText("Краве сирене")).toBeVisible();
    await expect(page.getByRole("table").getByText("12,50")).toBeVisible();

    /* 5. Редакция: вариантната цена е запазена */
    await page.getByRole("table").getByRole("link", { name: /Краве сирене/ }).click();
    await expect(page.getByRole("heading", { name: /Редакция/ })).toBeVisible();
    await expect(page.getByLabel("Цена за 1кг")).toHaveValue("23,00");
  });

  test("чужд потребител няма достъп до чужди продукти", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();

    /* Първи търговец с магазин и продукт */
    await register(page, `frizmo.e2e+owner${stamp}@gmail.com`);
    await createShopViaWizard(page, "Магазин на собственика", "Друго");

    await page.getByLabel("Име на продукта").fill("Таен продукт");
    await page.getByLabel("Цена", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Създай продукта" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: "Продукти", exact: true }).click();
    await page.getByRole("link", { name: /Таен продукт/ }).click();
    await expect(page.getByRole("heading", { name: /Редакция/ })).toBeVisible();
    const productUrl = page.url();

    /* Втори търговец (със собствен магазин) в отделна сесия опитва същия URL */
    const context = await browser.newContext();
    const intruder = await context.newPage();
    await register(intruder, `frizmo.e2e+intruder${stamp}@gmail.com`);
    await createShopViaWizard(intruder, "Магазин на натрапника", "Друго");

    await intruder.goto(productUrl);
    await expect(
      intruder.getByRole("heading", { name: "Страницата не е намерена" }),
    ).toBeVisible();
    await context.close();
  });
});

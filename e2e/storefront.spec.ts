import { expect, test, type Page } from "@playwright/test";
import { completeWebsiteWizard, createShopViaWizard } from "./helpers";

async function register(page: Page, email: string) {
  /* Cookie банерът и интро модалът на редактора покриват бутони — маркираме ги
     като видени */
  await page.addInitScript(() => {
    window.localStorage.setItem("frizmo-cookie-notice", "1");
    window.localStorage.setItem("frizmo-website-intro", "1");
  });
  await page.goto("/auth/register");
  await page.getByLabel("Име и фамилия").fill("Е2Е Търговец");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("parola123!");
  await page.getByRole("button", { name: "Регистрирай се" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("персонализация → публикуване → публичен магазин с variant picker", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await register(page, `frizmo.e2e+sf${Date.now()}@gmail.com`);

  /* Магазин + продукт с вариант */
  /* Пълен режим — тестът ползва опции/варианти („+ Добави опция"), които са
     само в пълен режим (Ф2). */
  await createShopViaWizard(page, "Е2Е Витрина", "Дрехи и мода", "full");

  await page.getByLabel("Име на продукта").fill("Синя тениска");
  await page.getByLabel("Цена", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Създай продукта" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  /* Добавяме вариант през редакцията (таб „Варианти" — Ф1) */
  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  await page.getByRole("link", { name: /Синя тениска/ }).click();
  await page.getByRole("tab", { name: "Варианти" }).click();
  await page.getByRole("button", { name: "+ Добави опция" }).click();
  await page.getByPlaceholder("Име на опцията (напр. Размер)").fill("Размер");
  const valueInput = page.getByPlaceholder("Напиши стойност и натисни Enter (напр. M)");
  await valueInput.fill("S");
  await valueInput.press("Enter");
  await valueInput.fill("M");
  await valueInput.press("Enter");
  await page.getByLabel("Цена за M").fill("25");
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page).toHaveURL(/\/dashboard\/products$/);

  /* Уебсайт: първото влизане минава през onboarding wizard-а → редактора */
  await page.getByRole("link", { name: "Уебсайт" }).click();
  await completeWebsiteWizard(page);
  await page.getByRole("button", { name: "Към редактора" }).click();
  /* Editor-ът е зареден, когато се появи publish контролата му */
  await expect(page.getByRole("button", { name: "Публикувай промените" })).toBeVisible({
    timeout: 15_000,
  });
  const publicUrl = await page
    .getByRole("link", { name: "Отвори сайта" })
    .getAttribute("href");
  expect(publicUrl).toBeTruthy();

  await page.getByRole("button", { name: "Редактирай" }).first().click();
  await page.getByLabel("Заглавие", { exact: true }).fill("Добре дошли във витрината");
  await page.getByRole("button", { name: "Готово" }).click();
  /* Публикуваме промените (draft → live за клиентите) */
  await page.getByRole("button", { name: "Публикувай промените" }).click();
  await expect(page.getByText(/Промените са запазени|на живо/)).toBeVisible();
  /* Мишката е върху toast-а (горе вдясно) → sonner паузира dismiss таймера и
     toast-ът покрива header бутоните. Местим я и чакаме да изчезне. */
  await page.mouse.move(10, 300);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 10_000 });

  /* Скрит магазин: анонимен посетител вижда 404 */
  const anonBefore = await browser.newContext();
  const anonPageBefore = await anonBefore.newPage();
  await anonPageBefore.goto(publicUrl!);
  await expect(
    anonPageBefore.getByRole("heading", { name: "Страницата не е намерена" }),
  ).toBeVisible();
  await anonBefore.close();

  /* Публикуване на магазина (видимост за клиенти). Проверяваме стабилното
     състояние (бутонът става „Скрий магазина") вместо ефимерния toast, който
     изчезва след 3-5с и флейква. publishShop + router.refresh() е бавен на прод
     билд → по-голям timeout. */
  await page.getByRole("button", { name: "Публикувай магазина" }).click();
  await expect(page.getByRole("button", { name: "Скрий магазина" })).toBeVisible({
    timeout: 20_000,
  });

  /* Анонимен посетител: начало → продукт → variant picker → търсене */
  const anon = await browser.newContext();
  const shopPage = await anon.newPage();
  await shopPage.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
  await shopPage.goto(publicUrl!);
  await expect(
    shopPage.getByRole("heading", { name: "Добре дошли във витрината" }),
  ).toBeVisible();

  await shopPage.getByRole("link", { name: /Синя тениска/ }).first().click();
  await expect(shopPage.getByText("20,00")).toBeVisible();
  await shopPage.getByRole("button", { name: "M", exact: true }).click();
  await expect(shopPage.getByText("25,00")).toBeVisible();

  await shopPage.goto(`${publicUrl}/products?search=Синя`);
  await expect(shopPage.getByRole("link", { name: /Синя тениска/ })).toBeVisible();
  await shopPage.goto(`${publicUrl}/products?search=НямаТакова`);
  await expect(shopPage.getByText("Нищо не намерихме")).toBeVisible();

  /* Условията са достъпни */
  await shopPage.goto(`${publicUrl}/terms`);
  await expect(
    shopPage.getByRole("heading", { name: "Условия за пазаруване" }),
  ).toBeVisible();

  await anon.close();
});

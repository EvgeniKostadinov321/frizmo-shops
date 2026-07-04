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

test("персонализация → публикуване → публичен магазин с variant picker", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await register(page, `frizmo.e2e+sf${Date.now()}@gmail.com`);

  /* Магазин + продукт с вариант */
  await page.getByRole("link", { name: "Създай магазин" }).click();
  await page.getByLabel("Име на магазина").fill("Е2Е Витрина");
  await selectOption(page, "Категория на бизнеса", "Дрехи и мода");
  await page.getByRole("button", { name: "Създай магазина" }).click();
  await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();

  await page.getByLabel("Име на продукта").fill("Синя тениска");
  await page.getByLabel("Цена", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Създай продукта" }).click();
  await expect(page.getByRole("heading", { name: "Табло" })).toBeVisible();

  /* Добавяме вариант през редакцията */
  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  await page.getByRole("link", { name: /Синя тениска/ }).click();
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

  /* Уебсайт: hero заглавие → запази */
  await page.getByRole("link", { name: "Уебсайт" }).click();
  await expect(page.getByRole("heading", { name: "Уебсайт" })).toBeVisible();
  const publicUrl = await page
    .getByRole("link", { name: "Отвори сайта ↗" })
    .getAttribute("href");
  expect(publicUrl).toBeTruthy();

  await page.getByRole("button", { name: "Редактирай" }).first().click();
  await page.getByLabel("Заглавие", { exact: true }).fill("Добре дошли във витрината");
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page.getByText("Промените са публикувани по сайта.")).toBeVisible();

  /* Чернова: анонимен посетител вижда 404 */
  const anonBefore = await browser.newContext();
  const anonPageBefore = await anonBefore.newPage();
  await anonPageBefore.goto(publicUrl!);
  await expect(
    anonPageBefore.getByRole("heading", { name: "Страницата не е намерена" }),
  ).toBeVisible();
  await anonBefore.close();

  /* Публикуване */
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Магазинът е публикуван! 🎉")).toBeVisible();

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
  await expect(shopPage.getByText("Няма продукти, отговарящи на търсенето.")).toBeVisible();

  /* Условията са достъпни */
  await shopPage.goto(`${publicUrl}/terms`);
  await expect(
    shopPage.getByRole("heading", { name: "Условия за пазаруване" }),
  ).toBeVisible();

  await anon.close();
});

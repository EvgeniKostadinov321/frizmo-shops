import { expect, test, type Page } from "@playwright/test";

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

test("пълен поръчков цикъл: deal промоция → checkout → управление → отказ връща наличността", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await register(page, `frizmo.e2e+ord${Date.now()}@gmail.com`);

  /* Магазин + продукт с наличност 5 и промоция „2 за 30" */
  await page.getByRole("link", { name: "Създай магазин" }).click();
  await page.getByLabel("Име на магазина").fill("Е2Е Поръчки");
  await page.getByLabel("Категория на бизнеса").selectOption("Храни и напитки");
  await page.getByRole("button", { name: "Създай магазина" }).click();
  await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();

  await page.getByLabel("Име на продукта").fill("Козе сирене");
  await page.getByLabel("Цена", { exact: true }).fill("20");
  await page.getByLabel("Наличност").fill("5");
  await page.getByRole("button", { name: "Създай продукта" }).click();
  await expect(page.getByRole("heading", { name: "Табло" })).toBeVisible();

  /* Промоция „купи 2 за 30" през редакцията */
  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  await page.getByRole("link", { name: /Козе сирене/ }).click();
  await page.getByLabel("Количествена промоция").check();
  await page.getByLabel("Купи (брой)").fill("2");
  await page.getByLabel("За обща цена").fill("30");
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page).toHaveURL(/\/dashboard\/products$/);

  /* Отваряме таб „Плащане и доставка" (сийдва дефолтите) и публикуваме */
  await page.getByRole("link", { name: "Плащане и доставка" }).click();
  await expect(page.getByText("Куриер до адрес")).toBeVisible();
  await expect(page.getByText("Наложен платеж")).toBeVisible();

  await page.getByRole("link", { name: "Уебсайт" }).click();
  const publicUrl = await page
    .getByRole("link", { name: "Отвори сайта ↗" })
    .getAttribute("href");
  await page.getByRole("button", { name: "Публикувай" }).click();
  await expect(page.getByText("Магазинът е публикуван! 🎉")).toBeVisible();

  /* ГОСТ: добавя 2 бр → deal цена 30,00 → checkout */
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
  await guest.goto(publicUrl!);
  await guest.getByRole("link", { name: /Козе сирене/ }).first().click();
  await expect(guest.getByText(/Купи 2 бр за общо/)).toBeVisible();
  await guest.getByRole("button", { name: "Увеличи количеството" }).click();
  await guest.getByRole("button", { name: "Добави в количката" }).click();
  await expect(guest.getByText("Добавено в количката.")).toBeVisible();

  await guest.goto(`${publicUrl}/cart`);
  await expect(guest.getByText(/2 бр за 30,00/)).toBeVisible();
  await expect(guest.getByText("30,00", { exact: false }).first()).toBeVisible();
  await guest.getByRole("link", { name: "Завърши поръчката" }).click();

  await expect(
    guest.getByRole("heading", { name: "Завършване на поръчката" }),
  ).toBeVisible();

  /* Невалиден телефон първо */
  await guest.getByLabel(/Име и фамилия/).fill("Гост Купувач");
  await guest.getByLabel(/Телефон/).fill("12345");
  await guest.getByLabel(/Адрес за доставка/).fill("ул. Тестова 1");
  await guest.getByLabel(/Град/).fill("Пловдив");
  await guest.getByRole("button", { name: "Потвърди поръчката" }).click();
  await expect(guest.getByText(/Невалиден телефонен номер/)).toBeVisible();

  /* Валидни данни */
  await guest.getByLabel(/Телефон/).fill("0888123456");
  await guest.getByRole("button", { name: "Потвърди поръчката" }).click();
  await expect(guest.getByRole("heading", { name: "Поръчката е приета!" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(guest.getByText("#0001")).toBeVisible();
  await guestContext.close();

  /* ТЪРГОВЕЦЪТ: вижда поръчката, потвърждава, наличността е 3 */
  await page.getByRole("link", { name: "Поръчки", exact: true }).click();
  await page.getByRole("link", { name: "#0001" }).click();
  await expect(page.getByText("Гост Купувач")).toBeVisible();
  await expect(page.getByText(/2 бр за 30,00/)).toBeVisible();
  await page.getByRole("button", { name: "Потвърди", exact: true }).click();
  await expect(page.getByText("Потвърдена")).toBeVisible();

  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  await expect(page.getByRole("cell", { name: "3", exact: true })).toBeVisible();

  /* Отказ → наличността се връща на 5 */
  await page.getByRole("link", { name: "Поръчки", exact: true }).click();
  await page.getByRole("link", { name: "#0001" }).click();
  await page.getByRole("button", { name: "Откажи поръчката" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Откажи поръчката" })
    .click();
  await expect(page.getByText("Отказана")).toBeVisible();

  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  await expect(page.getByRole("cell", { name: "5", exact: true })).toBeVisible();
});

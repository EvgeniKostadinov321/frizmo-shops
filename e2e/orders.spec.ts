import { expect, test, type Page } from "@playwright/test";
import { completeWebsiteWizard, createShopViaWizard } from "./helpers";

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

  /* Магазин + продукт с наличност 5 и промоция „2 за 30". Пълен режим —
     тестът ползва „Количествена промоция" (deal), която е само в пълен режим (Ф2). */
  await createShopViaWizard(page, "Е2Е Поръчки", "Храни и напитки", "full");

  await page.getByLabel("Име на продукта").fill("Козе сирене");
  await page.getByLabel("Цена", { exact: true }).fill("20");
  await page.getByLabel("Наличност").fill("5");
  await page.getByRole("button", { name: "Създай продукта" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  /* Промоция „купи 2 за 30" през редакцията (таб „Варианти" — Ф1) */
  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  await page.getByRole("link", { name: /Козе сирене/ }).click();
  await page.getByRole("tab", { name: "Варианти" }).click();
  /* Custom Checkbox: реалният input е sr-only (span покрива клика) → кликаме
     етикета вместо .check() на скрития input. */
  await page.getByText("Количествена промоция", { exact: true }).click();
  await page.getByLabel("Купи (брой)").fill("2");
  await page.getByLabel("За обща цена").fill("30");
  await page.getByRole("button", { name: "Запази промените" }).click();
  await expect(page).toHaveURL(/\/dashboard\/products$/);

  /* Отваряме таб „Плащане и доставка" (сийдва дефолтите) и публикуваме.
     Ф1: секцията е разделена на табове — доставката е на таб „Доставка"
     (default), плащането на таб „Плащане". */
  await page.getByRole("link", { name: "Плащане и доставка" }).click();
  await expect(page.getByText("Куриер до адрес")).toBeVisible();
  /* Превключваме на таб „Плащане" за да видим наложения платеж. */
  await page.getByRole("tab", { name: "Плащане" }).click();
  await expect(page.getByText("Наложен платеж")).toBeVisible();

  /* Първото влизане в Уебсайт = onboarding wizard; публикуваме от финала му */
  await page.getByRole("link", { name: "Уебсайт" }).click();
  await completeWebsiteWizard(page);
  const publicUrl = await page
    .getByRole("link", { name: /Разгледай сайта си/ })
    .getAttribute("href");
  await page.getByRole("button", { name: "Публикувай — на живо за всички" }).click();
  /* publishShop + refresh е бавен на прод билд → по-голям timeout. */
  await expect(page.getByRole("heading", { name: "Магазинът ти е на живо!" })).toBeVisible({
    timeout: 20_000,
  });

  /* ГОСТ: добавя 2 бр → deal цена 30,00 → checkout */
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
  await guest.goto(publicUrl!);
  await guest.getByRole("link", { name: /Козе сирене/ }).first().click();
  await expect(guest.getByText(/Купи 2 бр за общо/)).toBeVisible();
  await guest.getByRole("button", { name: "Увеличи количеството" }).click();
  await guest.getByRole("button", { name: "Добави в количката" }).click();
  await expect(guest.getByText("Добавени 2 бр в количката.")).toBeVisible();

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
  /* Номерът се показва на 2 места (потвърждение + „запиши си номер") → .first(). */
  await expect(guest.getByText("#0001").first()).toBeVisible();
  await guestContext.close();

  /* ТЪРГОВЕЦЪТ: вижда поръчката, потвърждава, наличността е 3.
     (Финалът на wizard-а е в builder layout без страничния nav → goto.) */
  await page.goto("/dashboard/orders");
  await page.getByRole("link", { name: "#0001" }).click();
  await expect(page.getByText("Гост Купувач").first()).toBeVisible();
  await expect(page.getByText(/2 бр за 30,00/)).toBeVisible();
  await page.getByRole("button", { name: "Потвърди", exact: true }).click();
  await expect(page.getByText("Потвърдена")).toBeVisible();

  await page.getByRole("link", { name: "Продукти", exact: true }).click();
  /* Наличност 3 в реда на „Козе сирене". Клетката носи и „Нисък склад" badge при
     ниска наличност → matchва по частичен текст в реда, не exact клетка. */
  await expect(
    page.getByRole("row").filter({ hasText: "Козе сирене" }).getByRole("cell", { name: /\b3\b/ }),
  ).toBeVisible();

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
  await expect(
    page.getByRole("row").filter({ hasText: "Козе сирене" }).getByRole("cell", { name: /\b5\b/ }),
  ).toBeVisible();
});

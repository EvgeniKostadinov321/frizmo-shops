import { expect, test, type Page } from "@playwright/test";

/* Онлайн плащане: избор на „Карта (ePay)" в checkout → pending_payment поръчка +
   опит за redirect към ePay. Спираме ПРЕДИ реалния epay.bg (нямаме реален акаунт):
   interceptваме заявката към ePay demo и проверяваме, че формата се submit-ва.
   Демо магазинът atelie-glina има ePay акаунт + online_card метод (seed-demo-shops.mjs). */

async function markCookieSeen(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("frizmo-cookie-notice", "1"));
}

test("онлайн метод → checkout submit-ва към ePay", async ({ page }) => {
  test.setTimeout(120_000);
  await markCookieSeen(page);

  /* Блокираме реалния ePay redirect (demo среда) и хващаме опита. */
  let epayHit = false;
  await page.route(/epay\.bg/, (route) => {
    epayHit = true;
    return route.fulfill({ status: 200, body: "OK (mock ePay)" });
  });

  /* Добави продукт в количката на демо магазина. */
  await page.goto("/s/atelie-glina/p/chasha-utro");
  await page.getByRole("button", { name: "Добави в количката" }).click();
  await page.goto("/s/atelie-glina/checkout");

  /* Попълни минимума за доставка до адрес (куриерът иска адрес + град). */
  await page.getByLabel("Име и фамилия").fill("Е2Е Плащане");
  await page.getByLabel("Телефон").fill("0888123456");
  await page.getByLabel("Адрес за доставка").fill("ул. Тестова 1");
  const cityField = page.getByLabel("Град", { exact: true });
  if (await cityField.count()) await cityField.fill("София");

  /* Избери онлайн метод „Карта (ePay)". Ако липсва → seed нужен. */
  const online = page.getByText("Карта (ePay)", { exact: true });
  if ((await online.count()) === 0) {
    test.skip(true, "Демо магазинът няма активен ePay метод — пусни seed-demo-shops.mjs.");
  }
  await online.click();

  await page.getByRole("button", { name: "Потвърди поръчката" }).click();

  /* Checkout се опита да submit-не към ePay (redirect за онлайн плащане). */
  await expect.poll(() => epayHit, { timeout: 20_000 }).toBe(true);
});

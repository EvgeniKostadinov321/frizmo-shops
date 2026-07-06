import { expect, test } from "@playwright/test";

test.describe("Каталог, landing и блог", () => {
  test("landing рендерира с CTA, демота и цени", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Продавай повече/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Създай магазина си безплатно" }).first(),
    ).toBeVisible();
    /* Името се появява и в hero телефона, и в демо картата — first() */
    await expect(page.getByText("Ателие Глина").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Прости, честни цени" })).toBeVisible();

    /* Cookie банерът се затваря и не се връща */
    await page.getByRole("button", { name: "Разбрах" }).click();
    await expect(page.getByRole("button", { name: "Разбрах" })).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Разбрах" })).not.toBeVisible();
  });

  test("каталогът с магазини намира демо магазин по търсене", async ({ page }) => {
    await page.goto("/shops");
    await page.getByLabel("Търсене на магазини").fill("Глина");
    await page.getByRole("button", { name: "Търси" }).click();
    await expect(page.getByText("Ателие Глина").first()).toBeVisible();
    await expect(page.getByText("Сигнал Техника")).not.toBeVisible();

    /* Отваря се публичният магазин */
    await page.getByText("Ателие Глина").first().click();
    await expect(page).toHaveURL(/\/s\/atelie-glina/);
  });

  test("продуктовият каталог филтрира по промоции", async ({ page }) => {
    await page.goto("/products?promo=1");
    /* Демо сийдът има продукти с промо цени */
    await expect(page.getByText("Промо").first()).toBeVisible();
    await expect(page.getByText(/\d+ продукта?/).first()).toBeVisible();
  });

  test("блог статия се отваря с типография и CTA", async ({ page }) => {
    await page.goto("/blog");
    await page.getByRole("link", { name: /Как да продаваш онлайн/ }).click();
    await expect(
      page.getByRole("heading", { name: /Как да продаваш онлайн без сайт/ }),
    ).toBeVisible();
    await expect(page.getByText("Скритата цена на продаването").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Създай магазина си", exact: true }),
    ).toBeVisible();
  });
});

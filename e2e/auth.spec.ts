import { expect, test } from "@playwright/test";

test.describe("Auth поток", () => {
  test("регистрация → dashboard → изход → защитата пази", async ({ page }) => {
    // Реален домейн — Supabase отхвърля недоставими домейни (.test) с email_address_invalid.
    // При изключено "Confirm email" не се изпраща нищо към адреса.
    const email = `frizmo.e2e+${Date.now()}@gmail.com`;

    await page.goto("/auth/register");
    await page.getByLabel("Име и фамилия").fill("Е2Е Тест");
    await page.getByLabel("Имейл").fill(email);
    await page.getByLabel("Парола").fill("parola123!");
    await page.getByRole("button", { name: "Регистрирай се" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Добре дошъл!" })).toBeVisible();

    await page.getByRole("button", { name: "Изход" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("невалидни данни показват грешки", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "Влез" }).click();
    await expect(page.getByText("Невалиден имейл")).toBeVisible();
  });

  test("грешна парола показва общо съобщение", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Имейл").fill("nyama.takav.frizmo@gmail.com");
    await page.getByLabel("Парола").fill("greshna-parola");
    await page.getByRole("button", { name: "Влез" }).click();
    await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
  });
});

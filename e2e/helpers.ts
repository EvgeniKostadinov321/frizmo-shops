import { expect, type Page } from "@playwright/test";

/**
 * Избор от custom <Select> (button + listbox, не native select).
 * Кликва тригера по неговия aria-label, после опцията по текст.
 */
export async function selectOption(page: Page, label: string, optionLabel: string) {
  const trigger = page.getByLabel(label, { exact: true });
  const listbox = page.getByRole("listbox", { name: label });
  /* Retry на клика: под паралелни workers кликът може да изпревари React
     hydration-а (dev компилация) → бутонът е видим, но без handler. */
  await expect(async () => {
    await trigger.click();
    await expect(listbox).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await listbox.getByRole("option", { name: optionLabel, exact: true }).click();
}

/**
 * Минава shop wizard-а (Основно → Контакти → Работно време → Сложност) с минимума
 * задължителни полета и създава магазина. Чака индикатора да маркира всяка
 * под-стъпка (бутонът „Напред"→„Създай магазина" се сменя при re-render).
 */
export async function createShopViaWizard(page: Page, name: string, category: string) {
  await page.getByRole("link", { name: "Създай магазин" }).click();
  await page.getByLabel("Име на магазина").fill(name);
  await selectOption(page, "Категория на бизнеса", category);
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
  /* Ф2: 4-та стъпка „Сложност" (default „Малък бизнес" е предизбран) → продължаваме. */
  await page.getByRole("button", { name: "Напред" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Сложност" })).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByRole("button", { name: "Създай магазина" }).click();
  await expect(page.getByRole("heading", { name: "Добави първия си продукт" })).toBeVisible();
}

/**
 * Минава onboarding wizard-а на таб „Уебсайт" по най-краткия път (нов магазин
 * го вижда задължително при първо влизане). Завършва на финалния екран
 * „Сайтът ти е готов!" — оттам тестът избира „Към редактора" или „Публикувай".
 */
export async function completeWebsiteWizard(page: Page) {
  await page.getByRole("button", { name: "Старт" }).click();
  await page.getByRole("button", { name: "Напред" }).click(); // тема (препоръчаната)
  await page.getByRole("button", { name: "Прескочи — първата е добра" }).click(); // цветове
  await page.getByRole("button", { name: "Напред" }).click(); // снимки (без)
  await page.getByRole("button", { name: "Прескочи — ще добавя после" }).click(); // продукти → генерация
  await expect(page.getByRole("heading", { name: "Сайтът ти е готов!" })).toBeVisible({
    timeout: 20_000,
  });
}

import { expect, type Page } from "@playwright/test";

/**
 * Избор от custom <Select> (button + listbox, не native select).
 * Кликва тригера по неговия aria-label, после опцията по текст.
 */
export async function selectOption(page: Page, label: string, optionLabel: string) {
  const trigger = page.getByLabel(label, { exact: true });
  await trigger.click();
  const listbox = page.getByRole("listbox", { name: label });
  await expect(listbox).toBeVisible();
  await listbox.getByRole("option", { name: optionLabel, exact: true }).click();
}

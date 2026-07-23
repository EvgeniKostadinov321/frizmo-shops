import { hasOverdueFees, requiresCard } from "@/db/queries/fees";

/**
 * Единственият checkout gate. Магазинът приема поръчки само ако:
 *  - няма просрочена такса (Gate 1), И
 *  - не се изисква карта след първата продажба (Gate 2 / card-gate).
 * Заменя стария plan.ts billingAllowsSelling/isShopActive изцяло.
 */
export async function canAcceptOrders(shopId: string): Promise<boolean> {
  const [overdue, needsCard] = await Promise.all([hasOverdueFees(shopId), requiresCard(shopId)]);
  return !overdue && !needsCard;
}

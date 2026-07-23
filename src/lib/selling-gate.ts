import "server-only";
import { hasOverdueFees, cardState } from "@/db/queries/fees";
import { customerHasDefaultCard } from "@/lib/stripe";

/**
 * Card-gate: магазинът трябва да запази карта СЛЕД първата завършена продажба.
 * requiresCard = имало е ≥1 charge И няма запазена карта (няма Customer, или
 * Customer без default_payment_method). Живее тук (не в fees.ts), защото ползва
 * Stripe (server-only) — fees.ts остава чист DB модул.
 */
export async function requiresCard(shopId: string): Promise<boolean> {
  const { hasCharge, customerId } = await cardState(shopId);
  if (!hasCharge) return false; // няма още таксуема продажба → карта не се иска
  if (!customerId) return true; // има charge, няма Customer → иска карта
  /* customerHasDefaultCard прави жив Stripe round-trip. canAcceptOrders (→ този код) е на
     публичния checkout път. Stripe outage/rate-limit НЕ бива да сваля продажбите на вече
     установен магазин — билинг проблем ≠ проблем с поръчката. Fail-open: при Stripe грешка
     не блокираме (връщаме false); следващият успешен billing цикъл ще хване липсата на карта. */
  try {
    return !(await customerHasDefaultCard(customerId));
  } catch (e) {
    console.error(
      JSON.stringify({ scope: "requiresCard-stripe", shopId, error: e instanceof Error ? e.message : String(e) }),
    );
    return false;
  }
}

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

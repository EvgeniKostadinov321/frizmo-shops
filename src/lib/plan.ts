/**
 * До План 6 (Stripe) няма subscriptions таблица: всеки магазин е в trial,
 * а trial = пълен Pro достъп (спец §10). Това е ЕДИНСТВЕНОТО място, което
 * План 6 ще замени с реална проверка по subscriptions.
 */
export type PlanId = "starter" | "pro";

export const PLAN_LIMITS = {
  starter: { maxProducts: 50 },
  pro: { maxProducts: Infinity },
} as const;

export async function getShopPlan(_shopId: string): Promise<PlanId> {
  return "pro";
}

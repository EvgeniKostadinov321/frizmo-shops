import { getSubscription } from "@/db/queries/subscriptions";

export type PlanId = "starter" | "pro";

export const PLAN_LIMITS = {
  starter: { maxProducts: 50 },
  pro: { maxProducts: Infinity },
} as const;

const TRIAL_DAYS = 30;
const DAY_MS = 86_400_000;

type SubShape = { plan?: PlanId; status: string } | null;

/** В trial ли е магазин без subscription (по дата на създаване)? */
export function inSignupTrial(createdAt: Date): boolean {
  return Date.now() < createdAt.getTime() + TRIAL_DAYS * DAY_MS;
}

/** Чиста функция — планът от subscription статуса (тествана). */
export function resolvePlan(sub: SubShape, shopCreatedAt: Date): PlanId {
  if (!sub) return inSignupTrial(shopCreatedAt) ? "pro" : "starter";
  if (sub.status === "trialing" || sub.status === "active" || sub.status === "past_due") {
    return sub.plan ?? "pro";
  }
  return "starter"; // suspended / canceled → fallback лимити
}

/** Чиста функция — billing позволява ли продажби (тествана). */
export function billingAllowsSelling(sub: SubShape, shopCreatedAt: Date): boolean {
  if (!sub) return inSignupTrial(shopCreatedAt);
  return sub.status === "trialing" || sub.status === "active" || sub.status === "past_due";
}

/** Реалният план на магазина (заменя stub-а). Единственото място за плановата логика. */
export async function getShopPlan(shopId: string, shopCreatedAt: Date): Promise<PlanId> {
  const sub = await getSubscription(shopId);
  return resolvePlan(sub, shopCreatedAt);
}

/** Billing позволява ли магазинът да продава (checkout gate). */
export async function isShopActive(shopId: string, shopCreatedAt: Date): Promise<boolean> {
  const sub = await getSubscription(shopId);
  return billingAllowsSelling(sub, shopCreatedAt);
}

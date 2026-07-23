import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/db";

/**
 * Stripe клиент — server-only. API версията е pin-ната изрично (не зависи от
 * SDK ъпдейти). Ключът е Restricted API Key (rk_), не secret — минимални права.
 * Споделен акаунт с другия Frizmo проект: изолацията е през metadata.app +
 * отделен webhook secret + отделни Price-ове.
 *
 * Ленива инициализация: `next build` импортира route/action модулите за
 * page-data collection дори без да ги изпълнява — `new Stripe()` хвърля
 * синхронно, ако ключът липсва (напр. локален build без STRIPE_SECRET_KEY).
 * Proxy-то отлага конструирането до първия реален достъп по runtime.
 */
let stripeClient: Stripe | undefined;
function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2026-06-24.dahlia",
      appInfo: { name: "frizmo-shops" },
    });
  }
  return stripeClient;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeClient(), prop, receiver);
  },
});

/** Metadata таг на всеки Stripe обект — за изолация в споделения акаунт. */
export const STRIPE_APP_TAG = "frizmo-shops";

/** Дали Stripe е конфигуриран (има secret ключ). Гард за „спящ" билинг. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Взима или създава Stripe Customer за магазина (idempotent — пази id-то в
 * subscriptions.stripeCustomerId). Споделен източник за card-setup и billing cron.
 * `subscriptions` таблицата се преизползва само за Customer id (планове няма).
 */
export async function ensureStripeCustomer(
  shopId: string,
  email: string,
  name: string,
): Promise<string> {
  const [existing] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.shopId, shopId))
    .limit(1);
  if (existing?.customerId) return existing.customerId;

  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    metadata: { app: STRIPE_APP_TAG, shopId },
  });
  /* Частичен ред веднага (customer id), за да е idempotent при повторен клик.
     status е нужен (NOT NULL) — „active" е неутрален за таксовия модел. */
  await db
    .insert(subscriptions)
    .values({ shopId, stripeCustomerId: customer.id, status: "active" })
    .onConflictDoNothing({ target: subscriptions.shopId });
  return customer.id;
}

/** Има ли Customer запазена default карта (за card-gate / авто-теглене)? */
export async function customerHasDefaultCard(customerId: string): Promise<boolean> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return false;
  return Boolean(customer.invoice_settings?.default_payment_method);
}

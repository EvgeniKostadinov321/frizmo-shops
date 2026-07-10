import "server-only";
import Stripe from "stripe";

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

/** Price ID по план (от env). */
export function priceIdForPlan(plan: "starter" | "pro"): string {
  const id = plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;
  if (!id) throw new Error(`Липсва Stripe Price ID за план ${plan}`);
  return id;
}

/** Дали Stripe е конфигуриран (има secret ключ). Гард за „спящ" билинг. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

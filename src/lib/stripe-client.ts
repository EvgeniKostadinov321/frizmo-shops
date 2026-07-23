import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Клиентски Stripe singleton (publishable key — безопасен за браузъра).
 * loadStripe се вика веднъж; null ако ключът липсва (билинг „спящ" локално).
 */
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

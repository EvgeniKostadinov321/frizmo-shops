"use server";

import { db, subscriptions } from "@/db";
import { requireShop } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { stripe, priceIdForPlan, STRIPE_APP_TAG } from "@/lib/stripe";
import { getSubscription } from "@/db/queries/subscriptions";
import { z } from "zod";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  promoCode: z.string().trim().max(40).optional(),
});

/** Взима или създава Stripe Customer за магазина (idempotent — пази id-то). */
async function ensureCustomer(shopId: string, email: string, name: string): Promise<string> {
  const existing = await getSubscription(shopId);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    metadata: { app: STRIPE_APP_TAG, shopId },
  });
  /* Записваме частичен ред веднага (customer id), за да е idempotent при повторен клик. */
  await db
    .insert(subscriptions)
    .values({ shopId, stripeCustomerId: customer.id, status: "trialing" })
    .onConflictDoNothing({ target: subscriptions.shopId });
  return customer.id;
}

/** Промо код (човешки, напр. FRIZMO50) → Stripe promotion_code id. Невалиден → грешка. */
async function resolvePromoCode(code: string): Promise<string> {
  const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  const promo = list.data[0];
  if (!promo) throw new Error("INVALID_PROMO");
  return promo.id;
}

export async function createCheckoutSession(rawInput: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалиден план.");
  const { shop, user } = await requireShop();

  try {
    const customerId = await ensureCustomer(shop.id, user.email ?? "", shop.name);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdForPlan(parsed.data.plan), quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { app: STRIPE_APP_TAG, shopId: shop.id },
      },
      /* Промо код: Stripe валидира FRIZMO50; невалиден → отхвърля. allow_promotion_codes
         показва поле в Checkout, а discounts го прилага директно ако е подаден. */
      ...(parsed.data.promoCode
        ? { discounts: [{ promotion_code: await resolvePromoCode(parsed.data.promoCode) }] }
        : { allow_promotion_codes: true }),
      metadata: { app: STRIPE_APP_TAG, shopId: shop.id },
      success_url: `${BASE_URL}/dashboard/billing?success=1`,
      cancel_url: `${BASE_URL}/dashboard/billing`,
    });
    if (!session.url) return fail("Stripe не върна URL. Опитай пак.");
    return ok({ url: session.url });
  } catch (error) {
    if ((error as Error).message === "INVALID_PROMO") return fail("Промо кодът не е валиден.");
    console.error("createCheckoutSession се провали:", error);
    return fail("Плащането не можа да стартира. Опитай пак.");
  }
}

export async function createPortalSession(): Promise<ActionResult<{ url: string }>> {
  const { shop } = await requireShop();
  const sub = await getSubscription(shop.id);
  if (!sub?.stripeCustomerId) return fail("Няма активен абонамент за управление.");
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${BASE_URL}/dashboard/billing`,
    });
    return ok({ url: session.url });
  } catch (error) {
    console.error("createPortalSession се провали:", error);
    return fail("Порталът не можа да се отвори. Опитай пак.");
  }
}

export async function getBillingStatus(): Promise<
  ActionResult<{ status: string; plan: string; currentPeriodEnd: string | null }>
> {
  const { shop } = await requireShop();
  const sub = await getSubscription(shop.id);
  if (!sub) return ok({ status: "trial", plan: "pro", currentPeriodEnd: null });
  return ok({
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  });
}

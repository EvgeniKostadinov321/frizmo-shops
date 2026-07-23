"use server";

import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/db";
import { requireShop } from "@/lib/auth";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/**
 * Създава SetupIntent за запазване на карта (SCA-съвместимо, без реално теглене).
 * Търговецът запазва карта СЛЕД първата завършена продажба (card-gate), за да може
 * месечната такса да се тегли автоматично. Клиентът потвърждава с clientSecret.
 */
export async function createSetupIntent(): Promise<ActionResult<{ clientSecret: string }>> {
  try {
    const { user, shop } = await requireShop();
    const customerId = await ensureStripeCustomer(shop.id, user.email ?? "", shop.name);
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session", // за бъдещо авто-теглене на месечната фактура
      /* Таксата се тегли САМО с карта (месечно авто-теглене) → ограничаваме до карта.
         Иначе Stripe предлага нерелевантни за BG методи (Pix/Bancontact). Легитимно
         изключение от dynamic payment methods — тук нарочно искаме само карта. */
      payment_method_types: ["card"],
    });
    if (!intent.client_secret) return fail("Неуспешно създаване на заявка за карта.");
    return ok({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("createSetupIntent се провали:", error);
    return fail("Възникна грешка. Опитай пак.");
  }
}

/**
 * След успешен confirmSetup: задава запазената карта като default_payment_method на
 * Customer-а. БЕЗ това `customerHasDefaultCard` връща false → card-gate никога не пада
 * (месечната такса няма от какво да се тегли). Извиква се от клиента с setupIntentId.
 */
export async function setDefaultCard(setupIntentId: string): Promise<ActionResult> {
  try {
    const { shop } = await requireShop();
    /* Сигурност: работим САМО с Customer-а на ТОЗИ магазин (от нашата база), не с
       произволен от SetupIntent-а — иначе търговец би задал карта на чужд customer. */
    const [sub] = await db
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shop.id))
      .limit(1);
    if (!sub?.customerId) return fail("Липсва клиент за картата.");

    const intent = await stripe.setupIntents.retrieve(setupIntentId);
    const paymentMethodId = intent.payment_method;
    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return fail("Картата не е намерена. Опитай пак.");
    }
    /* SetupIntent-ът трябва да е за НАШИЯ customer (не чужд). */
    const intentCustomer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
    if (intentCustomer !== sub.customerId) return fail("Картата не принадлежи на този магазин.");

    await stripe.customers.update(sub.customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    return ok(null);
  } catch (error) {
    console.error("setDefaultCard се провали:", error);
    return fail("Картата се запази, но настройката ѝ като основна се провали.");
  }
}

/**
 * Премахва запазената карта (detach на default_payment_method от Customer-а).
 * ⚠️ Ако магазинът има таксуема продажба, след премахване card-gate се вдига →
 * магазинът спира да приема нови поръчки, докато не запази нова карта. Търговецът
 * решава — предупреждението е в UI-а.
 */
export async function removeCard(): Promise<ActionResult> {
  try {
    const { shop } = await requireShop();
    const [sub] = await db
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shop.id))
      .limit(1);
    if (!sub?.customerId) return fail("Няма запазена карта.");

    const customer = await stripe.customers.retrieve(sub.customerId);
    if (customer.deleted) return fail("Няма запазена карта.");
    const pmId = customer.invoice_settings?.default_payment_method;
    if (!pmId || typeof pmId !== "string") return fail("Няма запазена карта.");

    /* Detach-ва картата — Stripe автоматично маха и default_payment_method. */
    await stripe.paymentMethods.detach(pmId);
    return ok(null);
  } catch (error) {
    console.error("removeCard се провали:", error);
    return fail("Картата не можа да се премахне. Опитай пак.");
  }
}

"use server";

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
    });
    if (!intent.client_secret) return fail("Неуспешно създаване на заявка за карта.");
    return ok({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("createSetupIntent се провали:", error);
    return fail("Възникна грешка. Опитай пак.");
  }
}

import { db, shops } from "@/db";
import {
  getBillableBalanceForPeriod,
  recordInvoiceForPeriod,
  markInvoiceIssued,
} from "@/db/queries/fees";
import { stripe, ensureStripeCustomer, STRIPE_APP_TAG } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Периодът на ИЗМИНАЛИЯ календарен месец (UTC). */
function previousMonthUtc(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end };
}

/**
 * Месечен billing cron: за всеки магазин сумира таксовия ledger за изминалия месец,
 * записва fee_invoices (идемпотентно), и издава Stripe фактура с авто-теглене за
 * amountDue > 0. amountDue ≤ 0 → само audit ред, без Stripe фактура. Гарден с CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const { start, end } = previousMonthUtc(now);

  const allShops = await db.select({ id: shops.id, ownerId: shops.ownerId, name: shops.name }).from(shops);
  let issued = 0;
  let failed = 0;

  for (const shop of allShops) {
    /* Per-shop изолация: провал за един магазин (Stripe timeout/rate-limit/липсваща карта)
       не бива да спира издаването на фактурите за останалите. Логваме и продължаваме. */
    try {
      const balance = await getBillableBalanceForPeriod(shop.id, start, end);
      const invoice = await recordInvoiceForPeriod(shop.id, start, end, balance);
      if (!invoice || invoice.status !== "draft" || invoice.amountDueCents <= 0) continue;

      /* Имейлът на собственика е в Supabase auth.users (не в profiles) → admin API по ownerId. */
      const admin = createSupabaseAdmin();
      const { data: authUser } = await admin.auth.admin.getUserById(shop.ownerId);
      const email = authUser?.user?.email ?? "";

      const customerId = await ensureStripeCustomer(shop.id, email, shop.name);

      /* Ред за Stripe API 2026-06-24.dahlia: draft фактура ПЪРВО, после invoiceItem с
         явен invoice:id (иначе item-ът не се закача → фактура за 0 €). auto_advance:true
         оставя Stripe да финализира + тегли автоматично от запазената карта.
         idempotencyKey = feeInvoiceId → ако cron се пусне повторно (retry / частичен провал
         преди markInvoiceIssued), Stripe връща СЪЩАТА фактура вместо да създаде втора
         (иначе двойно авто-теглене на реални пари). */
      const stripeInvoice = await stripe.invoices.create(
        {
          customer: customerId,
          collection_method: "charge_automatically",
          auto_advance: true,
          metadata: { app: STRIPE_APP_TAG, feeInvoiceId: invoice.id },
        },
        { idempotencyKey: `fee-invoice-${invoice.id}` },
      );
      await stripe.invoiceItems.create(
        {
          customer: customerId,
          invoice: stripeInvoice.id,
          amount: invoice.amountDueCents,
          currency: "eur",
          description: `Такса за продажби (${start.toISOString().slice(0, 7)})`,
        },
        { idempotencyKey: `fee-invoice-item-${invoice.id}` },
      );
      await markInvoiceIssued(invoice.id, stripeInvoice.id!);
      issued++;
    } catch (e) {
      failed++;
      console.error(
        JSON.stringify({ scope: "bill-fees", shopId: shop.id, error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  return Response.json({ issued, failed });
}

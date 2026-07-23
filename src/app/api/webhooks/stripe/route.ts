import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, feeInvoices, stripeEvents } from "@/db";
import { stripe, STRIPE_APP_TAG } from "@/lib/stripe";

export async function POST(req: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  /* Липсващ secret на прод → всеки event тихо би паднал като „невалиден подпис".
     Явен лог + 500, за да е видимо в логовете при go-live (виж CLAUDE.md: env
     промяна изисква Redeploy), вместо мълчаливо да не се синхронизира билингът. */
  if (!webhookSecret) {
    console.error("Stripe webhook: липсва STRIPE_WEBHOOK_SECRET — билингът няма да се синхронизира.");
    return new Response("Webhook not configured", { status: 500 });
  }

  const body = await req.text(); // RAW — никога req.json() преди верификация
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  /* Идемпотентност: at-least-once → dedup по event id. */
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });
  if (inserted.length === 0) return new Response("Already processed", { status: 200 });

  try {
    await handleEvent(event);
  } catch (error) {
    console.error("Stripe webhook обработка се провали:", event.type, error);
    return new Response("Handler error", { status: 500 }); // Stripe ще retry-не
  }
  return new Response("OK", { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    /* Таксова фактура платена/провалена → синхронизираме fee_invoices.status.
       Фактурите носят metadata.app + metadata.feeInvoiceId (billing cron ги слага). */
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const feeInvoiceId = invoice.metadata?.feeInvoiceId;
      if (!feeInvoiceId) return;
      const newStatus = event.type === "invoice.paid" ? "paid" : "issued";
      await db
        .update(feeInvoices)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(feeInvoices.id, feeInvoiceId));
      revalidatePath("/dashboard/billing");
      break;
    }
    default:
      break; // игнорираме останалите (вкл. чужди subscription събития)
  }
}

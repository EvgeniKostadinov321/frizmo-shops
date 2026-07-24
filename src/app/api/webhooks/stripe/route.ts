import type Stripe from "stripe";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, feeInvoices, stripeEvents } from "@/db";
import { stripe, STRIPE_APP_TAG } from "@/lib/stripe";
import { issueInvBgForFeeInvoice, notifyMerchantInvoicePaid } from "@/lib/invbg-issue";

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
      /* Stripe доставя at-least-once и БЕЗ гарантиран ред. Закъснял/пренареден
         payment_failed СЛЕД paid не бива да връща платена фактура на „issued" (иначе
         hasOverdueFees по-късно я брои като просрочена → блокира магазин, който е платил).
         paid е финално състояние; failed се прилага само ако още не е paid. */
      if (event.type === "invoice.paid") {
        await db
          .update(feeInvoices)
          .set({ status: "paid", updatedAt: new Date() })
          .where(eq(feeInvoices.id, feeInvoiceId));
        /* M3: сверка — официалната фактура се сглобява от нашата amountDueCents; тя
           ТРЯБВА да съвпада с реално инкасираното от Stripe. Разминаване (ръчна корекция
           на Stripe фактурата, proration) → логваме, за да е видимо (не блокираме плащането). */
        if (typeof invoice.amount_paid === "number") {
          const localInvoice = await db.query.feeInvoices.findFirst({
            where: eq(feeInvoices.id, feeInvoiceId),
            columns: { amountDueCents: true },
          });
          if (localInvoice && localInvoice.amountDueCents !== invoice.amount_paid) {
            console.error(
              JSON.stringify({
                scope: "invbg-amount-mismatch",
                feeInvoiceId,
                localCents: localInvoice.amountDueCents,
                stripePaidCents: invoice.amount_paid,
              }),
            );
          }
        }
        /* Официална inv.bg фактура — best-effort, НЕ блокира webhook-а. Провал →
           маркира invBgStatus='failed' (retry job/admin го поема), но плащането
           остава синхронизирано (иначе Stripe би retry-нал целия event излишно). */
        try {
          const r = await issueInvBgForFeeInvoice(feeInvoiceId);
          if (r.status === "failed") {
            console.error(JSON.stringify({ scope: "invbg-issue", feeInvoiceId, reason: r.reason }));
          } else if (r.status === "issued" && r.issued) {
            /* т.3: извести търговеца с PDF линк. Best-effort — имейл провал не бива да
               засяга издадената фактура. Взимаме имейла от собственика на магазина. */
            await notifyMerchantInvoicePaid(r.issued).catch((e) =>
              console.error(JSON.stringify({ scope: "invbg-email", feeInvoiceId, error: String(e) })),
            );
          }
        } catch (e) {
          console.error(
            JSON.stringify({
              scope: "invbg-issue",
              feeInvoiceId,
              error: e instanceof Error ? e.message : String(e),
            }),
          );
        }
      } else {
        await db
          .update(feeInvoices)
          .set({ status: "issued", updatedAt: new Date() })
          .where(and(eq(feeInvoices.id, feeInvoiceId), ne(feeInvoices.status, "paid")));
      }
      revalidatePath("/dashboard/billing");
      break;
    }
    default:
      break; // игнорираме останалите (вкл. чужди subscription събития)
  }
}

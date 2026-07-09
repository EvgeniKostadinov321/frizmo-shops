import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptions, stripeEvents } from "@/db";
import { stripe, STRIPE_APP_TAG } from "@/lib/stripe";

/** Маппинг Stripe subscription статус → нашия enum. */
function mapStatus(s: Stripe.Subscription.Status): "trialing" | "active" | "past_due" | "suspended" | "canceled" {
  switch (s) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid": return "suspended";
    default: return "canceled"; // incomplete/incomplete_expired/paused
  }
}

/** Плана от Price ID (нашите два). null = чужд Price (друг проект) → игнорирай. */
function planFromPrice(priceId: string | undefined): "starter" | "pro" | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.text(); // RAW — никога req.json() преди верификация
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
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
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const shopId = session.metadata?.shopId;
      if (!shopId || !session.subscription) return;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await upsertFromSubscription(shopId, sub);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const shopId = sub.metadata?.shopId;
      if (!shopId) return;
      await upsertFromSubscription(shopId, sub);
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as unknown as { subscription?: string }).subscription;
      if (!subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.metadata?.app !== STRIPE_APP_TAG) return; // чужд проект
      const shopId = sub.metadata?.shopId;
      if (shopId) await upsertFromSubscription(shopId, sub);
      break;
    }
    default:
      break; // игнорираме останалите
  }
}

/** Записва subscription състоянието локално от Stripe обекта. */
async function upsertFromSubscription(shopId: string, sub: Stripe.Subscription): Promise<void> {
  const priceId = sub.items.data[0]?.price.id;
  const plan = planFromPrice(priceId);
  if (!plan) return; // чужд Price → не пипай
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

  await db
    .update(subscriptions)
    .set({
      stripeSubscriptionId: sub.id,
      plan,
      status: mapStatus(sub.status),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.shopId, shopId));
}

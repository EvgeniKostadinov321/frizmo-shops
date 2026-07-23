/**
 * Seed + тест на МЕСЕЧНАТА ФАКТУРА срещу реалния Stripe test API + dev база.
 * Симулира точно cron-а bill-fees: charge-ове в МИНАЛ месец → агрегация →
 * Stripe фактура (charge_automatically) → авто-теглене от запазената карта → плащане.
 * Оставя реален fee_invoices ред, за да го видиш в dashboard-а (таб Такси).
 *
 * Пусни: node --env-file=.env.local scripts/seed-fee-invoice.mjs
 * Изисква: STRIPE_SECRET_KEY (sk_test_), DATABASE_URL_MIGRATIONS, + магазинът
 * трябва да има ЗАПАЗЕНА КАРТА (default_payment_method) — иначе тегленето се проваля.
 */
import Stripe from "stripe";
import postgres from "postgres";

const sk = process.env.STRIPE_SECRET_KEY;
if (!sk?.startsWith("sk_test")) {
  console.error("✗ Трябва sk_test_ ключ. Намерен:", sk?.slice(0, 8));
  process.exit(1);
}
const stripe = new Stripe(sk, { apiVersion: "2026-06-24.dahlia" });
const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const SHOP_SLUG = "test-magazin-1";

/** Периодът на изминалия календарен месец (UTC) — точно както cron-а. */
function previousMonthUtc(now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end };
}

async function main() {
  const [shop] = await sql`select id, name from shops where slug=${SHOP_SLUG}`;
  if (!shop) throw new Error(`Няма магазин „${SHOP_SLUG}“.`);
  console.log("Магазин:", shop.name);

  const [sub] = await sql`select stripe_customer_id from subscriptions where shop_id=${shop.id}`;
  if (!sub?.stripe_customer_id) throw new Error("Магазинът няма Stripe Customer. Запази карта първо.");
  const customerId = sub.stripe_customer_id;

  // Провери, че има запазена карта (иначе авто-теглене се проваля).
  const customer = await stripe.customers.retrieve(customerId);
  const defPm = customer.invoice_settings?.default_payment_method;
  if (!defPm) throw new Error("Няма запазена карта (default_payment_method). Запази карта в dashboard-а първо.");
  console.log("Запазена карта: ✓", defPm);

  const { start, end } = previousMonthUtc(new Date());
  const period = start.toISOString().slice(0, 7);
  console.log("Тестов период (минал месец):", period);

  // ---- 1. Seed: charge-ове в МИНАЛИЯ месец (за да ги хване cron логиката) ----
  const midMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 15));
  // Нуждаем се от order_id (FK). Ползваме съществуваща поръчка на магазина или създаваме тестова.
  let [order] = await sql`select id from orders where shop_id=${shop.id} order by created_at desc limit 1`;
  if (!order) {
    [order] = await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone, shipping_name,
        shipping_price_cents, payment_name, payment_type, subtotal_cents, discount_cents, total_cents, status)
      values (${shop.id}, ${880000 + Math.floor(Math.random()*9000)}, '__seed__', '+359888000000',
        'Куриер', 0, 'Наложен платеж', 'cod', 4000, 0, 4000, 'completed') returning id`;
  }
  // Изчистваме стар seed charge за този order (за идемпотентност на скрипта).
  const [seedOrder] = await sql`
    insert into orders (shop_id, order_number, customer_name, customer_phone, shipping_name,
      shipping_price_cents, payment_name, payment_type, subtotal_cents, discount_cents, total_cents, status, completed_at)
    values (${shop.id}, ${890000 + Math.floor(Math.random()*9000)}, '__seed_fee__', '+359888000000',
      'Куриер', 0, 'Наложен платеж', 'cod', 4000, 0, 4000, 'completed', ${midMonth}) returning id`;
  await sql`
    insert into fee_events (shop_id, order_id, type, amount_cents, base_cents, occurred_at)
    values (${shop.id}, ${seedOrder.id}, 'charge', 200, 4000, ${midMonth})
    on conflict (order_id, type) do nothing`;
  console.log("Seed charge (200ct = 2.00€) в", period, "✓");

  // ---- 2. Cron логика: агрегация за периода ----
  const [bal] = await sql`
    select
      coalesce(sum(case when type='charge' then amount_cents else 0 end),0)::int as charges,
      coalesce(sum(case when type='credit' then amount_cents else 0 end),0)::int as credits
    from fee_events
    where shop_id=${shop.id} and occurred_at >= ${start} and occurred_at < ${end}`;
  const amountDue = bal.charges - bal.credits;
  console.log(`Баланс за ${period}: charges=${bal.charges} credits=${bal.credits} → дължимо=${amountDue}ct`);
  if (amountDue <= 0) throw new Error("Дължимо ≤ 0 — няма какво да се фактурира.");

  // ---- 3. recordInvoiceForPeriod (идемпотентно) ----
  await sql`
    insert into fee_invoices (shop_id, period_start, period_end, charges_cents, credits_cents, amount_due_cents, status)
    values (${shop.id}, ${start}, ${end}, ${bal.charges}, ${bal.credits}, ${amountDue}, 'draft')
    on conflict (shop_id, period_start) do nothing`;
  const [inv] = await sql`select id, status, amount_due_cents from fee_invoices where shop_id=${shop.id} and period_start=${start}`;
  console.log("fee_invoices ред:", inv.id, "| статус:", inv.status, "| дължимо:", inv.amount_due_cents + "ct");

  if (inv.status !== "draft") {
    console.log("⚠ Фактурата вече е обработена (статус:", inv.status + ") — прескачам Stripe. Виж я в dashboard-а.");
    await sql.end();
    return;
  }

  // ---- 4. Stripe фактура (draft→item→auto_advance тегли от картата) ----
  const stripeInvoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "charge_automatically",
    auto_advance: false, // ръчно финализираме за детерминистичен тест
    metadata: { app: "frizmo-shops", feeInvoiceId: inv.id },
  });
  await stripe.invoiceItems.create({
    customer: customerId, invoice: stripeInvoice.id,
    amount: amountDue, currency: "eur",
    description: `Такса за продажби (${period})`,
  });
  await stripe.invoices.finalizeInvoice(stripeInvoice.id);
  const paid = await stripe.invoices.pay(stripeInvoice.id);
  console.log("Stripe фактура:", stripeInvoice.id, "| статус:", paid.status, "| платено:", paid.amount_paid + "ct");

  // ---- 5. Маркирай issued→paid (webhook би го направил в прода) ----
  const finalStatus = paid.status === "paid" ? "paid" : "issued";
  await sql`update fee_invoices set status=${finalStatus}, stripe_invoice_id=${stripeInvoice.id}, updated_at=now() where id=${inv.id}`;
  console.log("fee_invoices статус обновен на:", finalStatus, "✓");

  console.log("\n✓ ГОТОВО — месечна фактура създадена и платена. Виж я в dashboard → Такси → Месечни такси.");
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e.message);
  await sql.end();
  process.exit(1);
});

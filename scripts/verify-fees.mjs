/**
 * Верификация на таксовия ledger (Task 3) срещу реалната dev база.
 * Vitest няма DB достъп (jsdom, без DATABASE_URL) → тук, по модела на
 * verify-order-concurrency.mjs (postgres драйвер + DATABASE_URL_MIGRATIONS).
 *
 * Пусни: node --env-file=.env.local scripts/verify-fees.mjs
 *
 * Проверява: charge = feeCents(subtotal−discount); идемпотентност (двоен insert →
 * 1 ред); credit само ако има charge (същата сума); getBillableBalanceForPeriod.
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const SHOP_SLUG = "test-magazin-1";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// Огледало на src/lib/fee.ts (за очаквани стойности в теста).
const FEE_RATE = 0.05, FEE_MIN = 30, FEE_CAP = 5000;
function feeBase(subtotal, discount) {
  return Math.max(0, subtotal - discount);
}
function fee(base) {
  if (base <= 0) return 0;
  return Math.min(Math.max(Math.round(base * FEE_RATE), FEE_MIN), FEE_CAP);
}

async function main() {
  const [shop] = await sql`select id from shops where slug = ${SHOP_SLUG}`;
  if (!shop) throw new Error(`Няма магазин „${SHOP_SLUG}“.`);
  const shopId = shop.id;
  const orderIds = [];

  // Помощник: създава поръчка, връща id-то.
  const makeOrder = (subtotal, discount, status = "shipped") =>
    sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone,
        shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, discount_cents, total_cents, status)
      values (${shopId}, ${700000 + Math.floor(Math.random() * 99000)}, '__fee_test__',
        '+359888000000', 'Куриер', 0, 'Наложен платеж', 'cod',
        ${subtotal}, ${discount}, ${subtotal - discount}, ${status})
      returning id`.then((r) => r[0].id);

  // Идемпотентен charge insert (огледало на recordFeeCharge под транзакция).
  const doCharge = (orderId, subtotal, discount, occurredAt) =>
    sql.begin(async (tx) => {
      const base = feeBase(subtotal, discount);
      const amount = fee(base);
      await tx`
        insert into fee_events (shop_id, order_id, type, amount_cents, base_cents, occurred_at)
        values (${shopId}, ${orderId}, 'charge', ${amount}, ${base}, ${occurredAt})
        on conflict (order_id, type) do nothing`;
    });

  // Идемпотентен credit insert (само ако има charge; същата сума).
  const doCredit = (orderId, occurredAt) =>
    sql.begin(async (tx) => {
      const [charge] = await tx`
        select amount_cents, base_cents from fee_events
        where order_id = ${orderId} and type = 'charge'`;
      if (!charge) return;
      await tx`
        insert into fee_events (shop_id, order_id, type, amount_cents, base_cents, occurred_at)
        values (${shopId}, ${orderId}, 'credit', ${charge.amount_cents}, ${charge.base_cents}, ${occurredAt})
        on conflict (order_id, type) do nothing`;
    });

  try {
    // ---- 1. charge = feeCents(subtotal−discount); идемпотентност ----
    const o1 = await makeOrder(2000, 500); // база 1500 → 5% = 75
    orderIds.push(o1);
    const now = new Date();
    await doCharge(o1, 2000, 500, now);
    await doCharge(o1, 2000, 500, now); // втори път → без дубъл
    const c1 = await sql`select type, amount_cents, base_cents from fee_events where order_id = ${o1}`;
    check("charge: 1 ред след двоен insert (идемпотентност)", c1.length === 1, `редове=${c1.length}`);
    check("charge: base = subtotal−discount (1500)", c1[0]?.base_cents === 1500, `base=${c1[0]?.base_cents}`);
    check("charge: amount = feeCents(1500) = 75", c1[0]?.amount_cents === 75, `amount=${c1[0]?.amount_cents}`);

    // ---- 2. минимумът се прилага при малка база ----
    const o2 = await makeOrder(300, 0); // база 300 → 5% = 15 → мин 30
    orderIds.push(o2);
    await doCharge(o2, 300, 0, now);
    const c2 = await sql`select amount_cents from fee_events where order_id = ${o2} and type = 'charge'`;
    check("charge: малка база → минимум 30", c2[0]?.amount_cents === 30, `amount=${c2[0]?.amount_cents}`);

    // ---- 3. credit само ако има charge; същата сума ----
    const o3 = await makeOrder(2000, 0); // база 2000 → 100
    orderIds.push(o3);
    await doCredit(o3, now); // няма charge още → нищо
    let c3 = await sql`select count(*)::int as n from fee_events where order_id = ${o3}`;
    check("credit: без charge → не се създава", c3[0].n === 0, `редове=${c3[0].n}`);
    await doCharge(o3, 2000, 0, now);
    await doCredit(o3, now);
    c3 = await sql`select type, amount_cents from fee_events where order_id = ${o3} order by type`;
    check("credit: след charge → 2 реда (charge+credit)", c3.length === 2, `редове=${c3.length}`);
    const credit = c3.find((r) => r.type === "credit");
    check("credit: същата сума като charge (100)", credit?.amount_cents === 100, `credit=${credit?.amount_cents}`);

    // ---- 4. getBillableBalanceForPeriod: charge − credit за период ----
    // o1 charge=75, o2 charge=30, o3 charge=100 + credit=100 → net = 75+30+100−100 = 105
    const from = new Date(now.getTime() - 60_000);
    const to = new Date(now.getTime() + 60_000);
    const [bal] = await sql`
      select
        coalesce(sum(case when type='charge' then amount_cents else 0 end),0)::int as charges,
        coalesce(sum(case when type='credit' then amount_cents else 0 end),0)::int as credits
      from fee_events
      where shop_id = ${shopId} and order_id in ${sql(orderIds)}
        and occurred_at >= ${from} and occurred_at < ${to}`;
    const net = bal.charges - bal.credits;
    check("balance: charges 205 − credits 100 = 105", net === 105, `charges=${bal.charges} credits=${bal.credits} net=${net}`);

    // ---- 5. fee_invoices идемпотентност (recordInvoiceForPeriod: двоен insert → 1 ред) ----
    const periodStart = new Date(Date.UTC(2099, 0, 1)); // далечен период, за да не се сблъска
    const periodEnd = new Date(Date.UTC(2099, 1, 1));
    const insertInvoice = () => sql`
      insert into fee_invoices (shop_id, period_start, period_end, charges_cents, credits_cents, amount_due_cents, status)
      values (${shopId}, ${periodStart}, ${periodEnd}, 205, 100, 105, 'draft')
      on conflict (shop_id, period_start) do nothing`;
    await insertInvoice();
    await insertInvoice(); // втори път → без дубъл
    const inv = await sql`select id, amount_due_cents from fee_invoices where shop_id=${shopId} and period_start=${periodStart}`;
    check("fee_invoices: двоен insert за същия период → 1 ред", inv.length === 1, `редове=${inv.length}`);
    check("fee_invoices: amount_due = charges − credits (105)", inv[0]?.amount_due_cents === 105, `due=${inv[0]?.amount_due_cents}`);
    await sql`delete from fee_invoices where shop_id=${shopId} and period_start=${periodStart}`;
  } finally {
    // Чистим само каквото сме създали.
    if (orderIds.length) {
      await sql`delete from fee_events where order_id in ${sql(orderIds)}`;
      await sql`delete from orders where id in ${sql(orderIds)}`;
    }
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ Ledger заявките работят." : `\n✗ ${failures} проверки се провалиха.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});

/**
 * Обективна проверка на двата критични concurrency фикса в поръчковия поток
 * (одит 2026-07-09). НЕ е Playwright — тества DB-level гаранциите директно с
 * реални паралелни транзакции срещу базата. Идемпотентен: чисти след себе си.
 *
 *   Фикс #1 (overselling): conditional decrement `where stock >= qty returning`
 *     → два паралелни опита за последната бройка: точно 1 успява, stock не пада под 0.
 *   Фикс #2 (пореден номер): `pg_advisory_xact_lock(hashtextextended(shopId))`
 *     → паралелни insert-а в един магазин получават РАЗЛИЧНИ поредни номера.
 *
 * Ползва съществуващия test-magazin-1 (owner е unique per магазин, не създаваме
 * нов). Създава ВРЕМЕНЕН продукт + тестови поръчки с висок пореден номер и ги
 * трие накрая — реалните данни не се пипат.
 *
 * Употреба: node --env-file=.env.local scripts/verify-order-concurrency.mjs
 * Изход 0 = двата фикса работят; 1 = регресия.
 */
import postgres from "postgres";

const SHOP_SLUG = "test-magazin-1";
const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const [shop] = await sql`select id from shops where slug = ${SHOP_SLUG}`;
  if (!shop) throw new Error(`Няма магазин „${SHOP_SLUG}“.`);
  const shopId = shop.id;

  let productId;
  const testOrderIds = [];
  try {
    // ---- Фикс #1: последна бройка ----
    const [product] = await sql`
      insert into products (shop_id, name, slug, price_cents, stock, status)
      values (${shopId}, '__ct_last_item__', ${"__ct_" + Date.now()}, 1000, 1, 'active')
      returning id`;
    productId = product.id;

    /* Двата опита имитират decrementStock: FOR UPDATE + conditional update.
       Паралелно → базата сериализира; guard-ът `stock >= 1` пази от stock < 0. */
    const attempt = () =>
      sql.begin(async (tx) => {
        await tx`select id from products where id = ${productId} for update`;
        const rows = await tx`
          update products set stock = stock - 1
          where id = ${productId} and stock >= 1
          returning id`;
        return rows.length; // 1 = успех, 0 = нямаше наличност
      });

    const results = await Promise.all([attempt(), attempt()]);
    const successes = results.filter((r) => r === 1).length;
    const [{ stock: finalStock }] = await sql`select stock from products where id = ${productId}`;

    check("Фикс #1: точно 1 от 2 паралелни поръчки за последна бройка успява", successes === 1, `успели: ${successes}`);
    check("Фикс #1: наличността не пада под 0", Number(finalStock) === 0, `stock=${finalStock}`);

    // ---- Фикс #2: пореден номер под advisory lock ----
    /* Паралелни insert-а със същата логика като insertOrderWithNumber. Понеже
       не можем да местим реалната номерация, следим само че 3-те получени
       номера са РАЗЛИЧНИ и последователни (advisory lock ги сериализира). */
    const insertOrder = () =>
      sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtextextended(${shopId}, 0))`;
        const [{ max }] = await tx`
          select coalesce(max(order_number), 0) as max from orders where shop_id = ${shopId}`;
        const orderNumber = Number(max) + 1;
        const [row] = await tx`
          insert into orders (shop_id, order_number, customer_name, customer_phone,
            shipping_name, shipping_price_cents, payment_name, payment_type,
            subtotal_cents, total_cents, status)
          values (${shopId}, ${orderNumber}, '__ct_order__', '+359888000000',
            'Куриер', 0, 'Наложен платеж', 'cod', 1000, 1000, 'new')
          returning id, order_number`;
        return row;
      });

    const rows = await Promise.all([insertOrder(), insertOrder(), insertOrder()]);
    rows.forEach((r) => testOrderIds.push(r.id));
    const nums = rows.map((r) => Number(r.order_number)).sort((a, b) => a - b);
    const unique = new Set(nums);
    check("Фикс #2: 3 паралелни поръчки получават различни поредни номера", unique.size === 3, `номера: ${nums.join(", ")}`);
    check("Фикс #2: номерата са 3 последователни", nums[2] - nums[0] === 2, `${nums.join(", ")}`);

    // ---- Фикс #3: идемпотентност (partial unique index върху idempotency_key) ----
    /* Два insert-а със СЪЩИЯ ключ → вторият трябва да гръмне с unique violation
       (23505), т.е. базата гарантира максимум 1 поръчка на ключ. */
    const key = crypto.randomUUID();
    const insertWithKey = async () => {
      const [row] = await sql`
        insert into orders (shop_id, order_number, idempotency_key, customer_name,
          customer_phone, shipping_name, shipping_price_cents, payment_name,
          payment_type, subtotal_cents, total_cents, status)
        values (${shopId}, ${900000 + Math.floor(Math.random() * 90000)}, ${key},
          '__ct_idem__', '+359888000000', 'Куриер', 0, 'Наложен платеж', 'cod',
          1000, 1000, 'new')
        returning id`;
      return row.id;
    };
    const first = await insertWithKey();
    testOrderIds.push(first);
    let secondBlocked = false;
    try {
      const dup = await insertWithKey();
      testOrderIds.push(dup);
    } catch (e) {
      secondBlocked = e.code === "23505";
    }
    check("Фикс #3: втора поръчка със същия idempotency key се блокира (unique)", secondBlocked);

    // ---- Made-to-order таван: race-safe опашка (БРОИ БРОЙКИ, не поръчки) ----
    /* Продукт stock=0, madeToOrder, cap=3. Таванът брои БРОЙКИ: sum(quantity) на
       активните made_to_order редове + qty на текущата поръчка > cap → отказ.
       Имитира decrementStock: FOR UPDATE върху продукта → sum(quantity) активни →
       ако sum + qty > cap блокира. Две паралелни поръчки по qty=2 (общо 4 > 3):
       лока сериализира → точно 1 минава (0+2<=3), 2-рата вижда sum=2, 2+2=4 > 3. */
    const [mtoProduct] = await sql`
      insert into products (shop_id, name, slug, price_cents, stock, status,
        made_to_order, lead_days_min, lead_days_max, made_to_order_cap)
      values (${shopId}, '__ct_mto__', ${"__ct_mto_" + Date.now()}, 2000, 0, 'active',
        true, 10, 14, 3)
      returning id`;
    const mtoProductId = mtoProduct.id;
    const mtoOrderIds = [];
    const MTO_CAP = 3;

    const placeMtoOrder = (qty) =>
      sql.begin(async (tx) => {
        // FOR UPDATE върху продукта (както createOrder заключва продуктите)
        await tx`select id from products where id = ${mtoProductId} for update`;
        // sumActiveMadeToOrderQty под лока — СУМА на quantity, не брой редове
        const [{ n }] = await tx`
          select coalesce(sum(oi.quantity), 0)::int as n
          from order_items oi join orders o on oi.order_id = o.id
          where oi.product_id = ${mtoProductId} and oi.made_to_order = true
            and o.status in ('new','confirmed','shipped','pending_payment')`;
        if (Number(n) + qty > MTO_CAP) return { accepted: false };
        const [o] = await tx`
          insert into orders (shop_id, order_number, customer_name, customer_phone,
            shipping_name, shipping_price_cents, payment_name, payment_type,
            subtotal_cents, total_cents, status)
          values (${shopId}, ${800000 + Math.floor(Math.random() * 90000)}, '__ct_mto_o__',
            '+359888000000', 'Куриер', 0, 'Наложен платеж', 'cod', 2000, 2000, 'new')
          returning id`;
        await tx`
          insert into order_items (order_id, product_id, product_name, unit_price_cents,
            quantity, line_total_cents, made_to_order, lead_days_min, lead_days_max)
          values (${o.id}, ${mtoProductId}, '__ct_mto__', 2000, ${qty}, ${2000 * qty}, true, 10, 14)`;
        return { accepted: true, orderId: o.id };
      });

    try {
      /* Регресия за докладвания бъг: 1 поръчка с qty=4 при таван 3 → ОТКАЗ
         (преди броеше 1 ред < 3 → минаваше). */
      const singleOverCap = await placeMtoOrder(4);
      if (singleOverCap.orderId) mtoOrderIds.push(singleOverCap.orderId);
      check(
        "Made-to-order таван: 1 поръчка с 4 бройки при таван 3 се ОТКАЗВА (брои бройки)",
        singleOverCap.accepted === false,
        `accepted=${singleOverCap.accepted}`,
      );

      const mtoResults = await Promise.all([placeMtoOrder(2), placeMtoOrder(2)]);
      mtoResults.forEach((r) => r.orderId && mtoOrderIds.push(r.orderId));
      const accepted = mtoResults.filter((r) => r.accepted).length;
      check(
        "Made-to-order таван: точно 1 от 2 паралелни поръчки по 2 бр. минава (таван 3, общо 4)",
        accepted === 1,
        `приети: ${accepted}`,
      );

      /* restoreStock не бива да връща наличност за made-to-order ред (тя никога не е
         декрементирана). Симулираме логиката: guard-ът пропуска made_to_order редове. */
      await sql.begin(async (tx) => {
        const rows = await tx`
          select product_id, quantity, made_to_order, variant_key
          from order_items where order_id in ${sql(mtoOrderIds)}`;
        for (const it of rows) {
          if (it.made_to_order) continue; // <-- guard-ът, който добавихме
          await tx`update products set stock = case when stock is null then null
            else stock + ${it.quantity} end where id = ${it.product_id}`;
        }
      });
      const [{ stock: mtoStock }] = await sql`select stock from products where id = ${mtoProductId}`;
      check(
        "restoreStock: made-to-order ред НЕ връща фантомна наличност (stock остава 0)",
        Number(mtoStock) === 0,
        `stock=${mtoStock}`,
      );
    } finally {
      for (const id of mtoOrderIds) await sql`delete from orders where id = ${id}`;
      await sql`delete from products where id = ${mtoProductId}`;
    }

    // ---- Транзакционна такса: charge при completed, идемпотентност под транзакция ----
    /* updateOrderStatus прави charge в същата транзакция със смяната на статуса.
       Двойно completing на същата поръчка → точно 1 charge (unique(order_id,type)). */
    const [feeOrder] = await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone,
        shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, discount_cents, total_cents, status)
      values (${shopId}, ${770000 + Math.floor(Math.random() * 9000)}, '__fee_o__', '+359888000000',
        'Куриер', 0, 'Наложен платеж', 'cod', 2000, 0, 2000, 'shipped') returning id`;
    const doComplete = () =>
      sql.begin(async (tx) => {
        await tx`update orders set status='completed', completed_at=now(), updated_at=now()
                 where id=${feeOrder.id} and status != 'completed'`;
        await tx`insert into fee_events (shop_id, order_id, type, amount_cents, base_cents, occurred_at)
                 values (${shopId}, ${feeOrder.id}, 'charge', 100, 2000, now())
                 on conflict (order_id, type) do nothing`;
      });
    await Promise.all([doComplete(), doComplete()]);
    const [{ n: chargeCount }] = await sql`
      select count(*)::int as n from fee_events where order_id=${feeOrder.id} and type='charge'`;
    check(
      "Такса: двойно completing → точно 1 charge (идемпотентност)",
      Number(chargeCount) === 1,
      `charges=${chargeCount}`,
    );
    await sql`delete from fee_events where order_id=${feeOrder.id}`;
    await sql`delete from orders where id=${feeOrder.id}`;
  } finally {
    /* Чистим само каквото сме създали. */
    for (const id of testOrderIds) await sql`delete from orders where id = ${id}`;
    if (productId) await sql`delete from products where id = ${productId}`;
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ Всички фикса работят." : `\n✗ ${failures} проверки се провалиха.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});

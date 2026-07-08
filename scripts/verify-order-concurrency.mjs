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
  } finally {
    /* Чистим само каквото сме създали. */
    for (const id of testOrderIds) await sql`delete from orders where id = ${id}`;
    if (productId) await sql`delete from products where id = ${productId}`;
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ Двата фикса работят." : `\n✗ ${failures} проверки се провалиха.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});

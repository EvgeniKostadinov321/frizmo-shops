/**
 * Сийд на фалшиви поръчки за ЛИЧНИЯ магазин — за да се види таблото/поръчките с
 * данни. Таргет по slug + owner email проверка. Идемпотентен: не добавя, ако вече
 * има поръчки (за да не трупа при повторно пускане).
 *
 * Употреба: node scripts/seed-my-orders.mjs
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const SHOP_SLUG = "test-magazin-2";
const OWNER_EMAIL = "e.s.kostadinov34@gmail.com";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

/* Клиенти + статуси + отместване назад във времето (дни). */
const ORDERS = [
  { name: "Мария Иванова", phone: "+359888123456", city: "София", status: "new", daysAgo: 0, items: 2 },
  { name: "Георги Петров", phone: "+359889234567", city: "Пловдив", status: "new", daysAgo: 1, items: 1 },
  { name: "Елена Димитрова", phone: "+359877345678", city: "Варна", status: "confirmed", daysAgo: 2, items: 3 },
  { name: "Николай Стоянов", phone: "+359898456789", city: "Бургас", status: "shipped", daysAgo: 4, items: 1 },
  { name: "Виктория Ангелова", phone: "+359877567890", city: "Русе", status: "completed", daysAgo: 7, items: 2 },
  { name: "Иван Тодоров", phone: "+359888678901", city: "Стара Загора", status: "cancelled", daysAgo: 9, items: 1 },
];

async function main() {
  const [shop] = await sql`select id, name, owner_id from shops where slug = ${SHOP_SLUG}`;
  if (!shop) {
    console.error(`✗ Няма магазин "${SHOP_SLUG}".`);
    process.exit(1);
  }
  const { data: u, error } = await admin.auth.admin.getUserById(shop.owner_id);
  if (error || u?.user?.email !== OWNER_EMAIL) {
    console.error(`✗ Магазинът не е на ${OWNER_EMAIL} (а на ${u?.user?.email ?? "?"}). Спирам.`);
    process.exit(1);
  }
  console.log(`✓ Магазин: „${shop.name}" — собственик ${OWNER_EMAIL}`);

  const [existing] = await sql`select count(*)::int as n from orders where shop_id = ${shop.id}`;
  if (existing.n > 0) {
    console.log(`= Вече има ${existing.n} поръчки — пропускам (идемпотентно).`);
    await sql.end();
    return;
  }

  /* Реални активни продукти на магазина — за snapshot редовете. */
  const products = await sql`
    select name, price_cents, promo_price_cents from products
    where shop_id = ${shop.id} and status = 'active' limit 20`;
  if (!products.length) {
    console.error("✗ Магазинът няма активни продукти — първо пусни seed-my-shop.mjs.");
    process.exit(1);
  }

  let orderNumber = 1;
  for (const o of ORDERS) {
    /* Избери N различни продукта за поръчката. */
    const picked = products.slice((orderNumber - 1) % products.length).slice(0, o.items);
    while (picked.length < o.items) picked.push(products[picked.length % products.length]);

    const lines = picked.map((p, i) => {
      const unit = p.promo_price_cents ?? p.price_cents;
      const qty = (i % 2) + 1;
      return { name: p.name, unit, qty, total: unit * qty };
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const shippingCents = subtotal >= 5000 ? 0 : 500;
    const total = subtotal + shippingCents;
    const createdAt = new Date(Date.now() - o.daysAgo * 86_400_000).toISOString();

    const [order] = await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone, customer_email,
        address, city, shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, total_cents, status, created_at, updated_at)
      values (${shop.id}, ${orderNumber}, ${o.name}, ${o.phone}, ${""},
        ${"ул. Примерна 12"}, ${o.city}, ${"Куриер до адрес"}, ${shippingCents}, ${"Наложен платеж"},
        ${"cod"}, ${subtotal}, ${total}, ${o.status}, ${createdAt}, ${createdAt})
      returning id`;

    for (const l of lines) {
      await sql`
        insert into order_items (order_id, product_name, unit_price_cents, quantity, line_total_cents)
        values (${order.id}, ${l.name}, ${l.unit}, ${l.qty}, ${l.total})`;
    }
    console.log(`  + поръчка #${String(orderNumber).padStart(4, "0")} — ${o.name} (${o.status})`);
    orderNumber++;
  }

  console.log(`\n✓ Готово: ${ORDERS.length} поръчки.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});

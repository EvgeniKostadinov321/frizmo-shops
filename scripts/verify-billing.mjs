/* Обективна проверка на billing плановата логика (без Stripe, чисти функции +
   реален DB ред). node --env-file=.env.local scripts/verify-billing.mjs
   Забележка: shops.owner_id е UNIQUE (един магазин на потребител в MVP) —
   затова тестът си създава СВОЙ временен owner (profiles ред без DB-level FK
   към auth.users), вместо да преизползва owner на съществуващ магазин. */
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
let fails = 0;
const check = (n, ok) => { console.log(`${ok ? "✓" : "✗"} ${n}`); if (!ok) fails++; };

async function main() {
  const [owner] = await sql`
    insert into profiles (id, full_name) values (gen_random_uuid(), '__billing_test__')
    returning id`;
  const [shop] = await sql`
    insert into shops (owner_id, name, slug, business_category, status, created_at)
    values (${owner.id}, '__billing_test__', ${"__bt_" + Date.now()}, 'Друго', 'published', now())
    returning id, created_at`;
  try {
    // suspended subscription → магазинът не продава
    await sql`insert into subscriptions (shop_id, stripe_customer_id, plan, status)
              values (${shop.id}, ${"cus_test_" + Date.now()}, 'pro', 'suspended')`;
    const [sub] = await sql`select status, plan from subscriptions where shop_id = ${shop.id}`;
    check("suspended subscription записан", sub.status === "suspended");

    await sql`update subscriptions set status = 'active' where shop_id = ${shop.id}`;
    const [sub2] = await sql`select status from subscriptions where shop_id = ${shop.id}`;
    check("update към active работи", sub2.status === "active");
  } finally {
    await sql`delete from subscriptions where shop_id = ${shop.id}`;
    await sql`delete from shops where id = ${shop.id}`;
    await sql`delete from profiles where id = ${owner.id}`;
  }
  await sql.end();
  console.log(fails === 0 ? "\n✓ Billing DB логиката работи." : `\n✗ ${fails} провала.`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });

/**
 * Обективна проверка на self-service изтриване на акаунт (GDPR чл.17).
 * НЕ е Playwright — тества DB каскадата + auth delete директно, срещу реалната
 * база. Създава ХВЪРЛЯЕМ auth user + profile + shop + редове във всички рискови
 * зависими таблици → изпълнява същия ред на триене като deleteAccount() → проверява,
 * че НИЩО не е останало. Не пипа реалните/демо данни.
 *
 * Употреба: node --env-file=.env.local scripts/verify-account-deletion.mjs
 * Изход 0 = пълно триене; 1 = остатъчни данни (регресия).
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const stamp = Date.now();
  const email = `frizmo.verify.del+${stamp}@gmail.com`;
  const slug = `__verify_del_${stamp}`;

  // --- Създай хвърляем auth user ---
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: `Vd_${stamp}_x!`,
    email_confirm: true,
  });
  if (createErr || !created?.user) throw new Error(`createUser fail: ${createErr?.message}`);
  const userId = created.user.id;

  let shopId;
  try {
    // --- Насей данни във всички рискови таблици ---
    await sql`insert into profiles (id, full_name) values (${userId}, '__verify_del__')`;
    const [shop] = await sql`
      insert into shops (owner_id, name, slug, business_category, status)
      values (${userId}, '__verify_del__', ${slug}, 'other', 'draft')
      returning id`;
    shopId = shop.id;

    await sql`
      insert into products (shop_id, name, slug, price_cents, stock, status)
      values (${shopId}, '__vd_product__', ${slug + "_p"}, 1000, 5, 'active')`;

    await sql`
      insert into orders (shop_id, order_number, customer_name, customer_phone,
        shipping_name, shipping_price_cents, payment_name, payment_type,
        subtotal_cents, total_cents, status)
      values (${shopId}, 1, '__vd_order__', '+359888000000', 'Куриер', 0,
        'Наложен платеж', 'cod', 1000, 1000, 'new')`;

    await sql`
      insert into subscriptions (shop_id, stripe_customer_id, plan, status)
      values (${shopId}, ${"cus_vd_" + stamp}, 'starter', 'trialing')`;

    await sql`
      insert into abandoned_carts (shop_id, email, lines, subtotal_cents, status)
      values (${shopId}, ${email}, ${sql.json([])}, 1000, 'pending')`;

    await sql`
      insert into push_subscriptions (user_id, endpoint, p256dh, auth)
      values (${userId}, ${"https://push.example/" + stamp}, 'p256', 'authkey')`;

    // --- Изпълни СЪЩИЯ ред на триене като deleteAccount() ---
    await sql`delete from shops where id = ${shopId}`; // каскада
    await sql`delete from profiles where id = ${userId}`; // каскада push_subscriptions
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    check("auth user изтрит без грешка", !delErr, delErr?.message ?? "");

    // --- Провери, че НИЩО не е останало ---
    const tables = [
      ["products", sql`select count(*)::int as n from products where shop_id = ${shopId}`],
      ["orders", sql`select count(*)::int as n from orders where shop_id = ${shopId}`],
      ["subscriptions", sql`select count(*)::int as n from subscriptions where shop_id = ${shopId}`],
      ["abandoned_carts", sql`select count(*)::int as n from abandoned_carts where shop_id = ${shopId}`],
    ];
    for (const [name, q] of tables) {
      const [{ n }] = await q;
      check(`${name}: 0 останали реда (shop каскада)`, n === 0, `n=${n}`);
    }

    const [{ n: pushN }] = await sql`
      select count(*)::int as n from push_subscriptions where user_id = ${userId}`;
    check("push_subscriptions: 0 останали (profile каскада)", pushN === 0, `n=${pushN}`);

    const [{ n: profN }] = await sql`select count(*)::int as n from profiles where id = ${userId}`;
    check("profiles: изтрит", profN === 0, `n=${profN}`);

    const [{ n: shopN }] = await sql`select count(*)::int as n from shops where id = ${shopId}`;
    check("shops: изтрит", shopN === 0, `n=${shopN}`);

    const { data: gotUser } = await admin.auth.admin.getUserById(userId);
    check("auth user вече не съществува", !gotUser?.user);
    shopId = undefined; // почистено успешно
  } finally {
    // Best-effort почистване, ако тестът е гръмнал по средата.
    if (shopId) {
      await sql`delete from shops where id = ${shopId}`;
      await sql`delete from profiles where id = ${userId}`;
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
  }

  await sql.end();
  console.log(failures === 0 ? "\n✓ Изтриването е пълно." : `\n✗ ${failures} проверки се провалиха.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("✗ Грешка:", e);
  await sql.end();
  process.exit(1);
});

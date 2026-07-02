/**
 * Чисти e2e тестовите акаунти (frizmo.e2e+*@gmail.com) и всичко тяхно:
 * магазини (cascade: продукти, категории, поръчки, настройки), профили, auth users.
 * Пуска се периодично при замърсена dev база: node scripts/cleanup-e2e.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });

const users = await sql`
  select id, email from auth.users where email like 'frizmo.e2e+%' or email like 'e2e+%'`;
console.log(`Намерени e2e акаунти: ${users.length}`);

if (users.length > 0) {
  const ids = users.map((u) => u.id);
  const shops = await sql`
    delete from shops where owner_id = any(${ids}::uuid[]) returning name`;
  await sql`delete from push_subscriptions where user_id = any(${ids}::uuid[])`;
  await sql`delete from profiles where id = any(${ids}::uuid[])`;
  await sql`delete from auth.users where id = any(${ids}::uuid[])`;
  console.log(`Изтрити: ${shops.length} магазина, ${users.length} акаунта.`);
}

const [counts] = await sql`select count(*) as shops from shops where status = 'published'`;
console.log(`Published магазини сега: ${counts.shops}`);
await sql.end();

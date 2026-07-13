/**
 * Health-check: показва към КОЯ база сочи подаденият env + бройки редове.
 * Пуска се: node --env-file=<файл> scripts/health-check-db.mjs
 * Ползва DATABASE_URL_MIGRATIONS (session pooler). Предпазка срещу
 * „прод сочи dev база" — проверяваме хоста + дали е празна.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
  console.error("Липсва DATABASE_URL_MIGRATIONS — подай --env-file.");
  process.exit(1);
}
/* Хостът от connection string-а — за да се вижда коя база сочим. */
const host = url.replace(/^.*@/, "").replace(/[/?].*$/, "");
const sql = postgres(url, { prepare: false });
/** Брои редове, но връща null ако таблицата още не съществува (преди db:push). */
async function safeCount(table) {
  try {
    const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
    return n;
  } catch {
    return null; // relation does not exist
  }
}
try {
  const [{ n: publicTables }] =
    await sql`select count(*)::int as n from information_schema.tables where table_schema='public'`;
  const shops = await safeCount("shops");
  const orders = await safeCount("orders");
  console.log(JSON.stringify({ host, publicTables, shops, orders }, null, 2));
} catch (e) {
  console.error("Health-check грешка (връзка?):", e.message);
  process.exit(1);
} finally {
  await sql.end();
}

/**
 * Еднократен setup на full-text търсенето: pg_trgm extension + GIN индекси.
 * Drizzle push не управлява extensions, затова е отделен скрипт.
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL_MIGRATIONS, { prepare: false });

await sql`create extension if not exists pg_trgm`;
await sql`create index if not exists products_name_trgm on products using gin (name gin_trgm_ops)`;
await sql`create index if not exists shops_name_trgm on shops using gin (name gin_trgm_ops)`;
await sql`create index if not exists shops_description_trgm on shops using gin (description gin_trgm_ops)`;

console.log("pg_trgm + GIN индексите са готови");
await sql.end();

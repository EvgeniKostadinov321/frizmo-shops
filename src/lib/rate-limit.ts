import { sql as rawSql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Фиксиран прозорец rate limiting върху Postgres (без Redis).
 * true = позволено; false = лимитът е достигнат.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const result = await db.execute(rawSql`
    insert into rate_limits ("key", window_start, count)
    values (${key}, now(), 1)
    on conflict ("key") do update set
      count = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now()
        else rate_limits.window_start
      end
    returning count
  `);

  const count = Number((result as unknown as { count: number }[])[0]?.count ?? 0);

  /* Опортюнистичен cleanup (без cron): ~1% от заявките трият записи с прозорец
     по-стар от 1 ден. Ключовете иначе живеят вечно и таблицата расте
     неограничено. Изпълнява се fire-and-forget — не бави отговора. */
  if (Math.random() < 0.01) {
    void db
      .execute(rawSql`delete from rate_limits where window_start < now() - interval '1 day'`)
      .catch((e) => console.error("rate_limits cleanup се провали:", e));
  }

  return count <= max;
}

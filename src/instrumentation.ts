/**
 * Next.js instrumentation — `register()` се вика веднъж при startup на всяка
 * сървърна инстанция, преди да поеме заявки. Ползваме го за fail-fast env
 * валидация: липсва ли критичен ключ, стартът пада с ясно съобщение вместо да
 * тръгне счупен и да гърми тихо по-късно.
 */
export async function register(): Promise<void> {
  /* Само Node runtime — edge middleware/proxy няма нужда от DB/Supabase env. */
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./env");
    validateEnv();
  }
}

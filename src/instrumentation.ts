import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation — `register()` се вика веднъж при startup на всяка
 * сървърна инстанция, преди да поеме заявки. Ползваме го за:
 *  1) fail-fast env валидация (липсва ли критичен ключ → стартът пада ясно);
 *  2) зареждане на Sentry конфига според runtime-а (server/edge).
 */
export async function register(): Promise<void> {
  /* Само Node runtime — edge middleware/proxy няма нужда от DB/Supabase env. */
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./env");
    validateEnv();
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/* Автоматично хваща всички необработени сървърни грешки от заявки (App Router,
   server actions, route handlers). Изисква @sentry/nextjs >= 8.28.0. */
export const onRequestError = Sentry.captureRequestError;

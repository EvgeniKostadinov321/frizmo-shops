import { z } from "zod";

/**
 * Централизирана валидация на env vars — fail-fast при липсващ КРИТИЧЕН ключ,
 * вместо тих провал по-късно (одит 2026-07-09: на прод бяха липсвали
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY и NEXT_PUBLIC_SITE_URL и никой не разбра, докато
 * функцията не се счупи).
 *
 * Критични → липсата хвърля (билдът/стартът пада с ясно съобщение).
 * Опционални → липсата само деградира функция (имейл/push/карта) — не гърми.
 *
 * NEXT_PUBLIC_* се четат буквално (не през obj[key]), защото Next ги inline-ва
 * при билд само когато са статично достъпни в кода.
 */
const criticalServer = {
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
};
const criticalPublic = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const criticalSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL липсва (Postgres connection)."),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY липсва (server-side Supabase)."),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL липсва или не е валиден URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY липсва."),
});

/**
 * Валидира критичните env vars. Вика се веднъж при startup (instrumentation.ts).
 * Хвърля с четим списък на липсващото — билдът/деплойът пада вместо да тръгне
 * счупен. На клиента не се вика (NEXT_PUBLIC_* там вече са inline-нати).
 */
export function validateEnv(): void {
  const result = criticalSchema.safeParse({ ...criticalServer, ...criticalPublic });
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.message}`).join("\n");
    throw new Error(`Липсват критични env vars:\n${issues}\n(виж CLAUDE.md за пълния списък)`);
  }

  /* Препоръчани — само предупреждение, функцията деградира грациозно. */
  const warnings: string[] = [];
  if (!process.env.RESEND_API_KEY) warnings.push("RESEND_API_KEY — имейлите няма да се пращат.");
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
    warnings.push("VAPID двойка — web push е изключен.");
  if (!process.env.NEXT_PUBLIC_SITE_URL)
    warnings.push("NEXT_PUBLIC_SITE_URL — имейл линковете ще ползват fallback домейн.");
  if (!process.env.PLATFORM_ADMIN_EMAILS)
    warnings.push("PLATFORM_ADMIN_EMAILS — /admin ще е недостъпен.");
  if (!process.env.CRON_SECRET)
    warnings.push(
      "CRON_SECRET — Vercel Cron ще връща 401: expire-payments (неплатени поръчки не се отменят, наличности заседват) и abandoned-carts няма да работят.",
    );
  if (!process.env.STRIPE_SECRET_KEY) warnings.push("STRIPE_SECRET_KEY — билингът (такса) е изключен.");
  if (!process.env.STRIPE_WEBHOOK_SECRET) warnings.push("STRIPE_WEBHOOK_SECRET — Stripe webhook (fee_invoices статус) няма да работи.");
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    warnings.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — card формата (запазване на карта) няма да зареди.");
  if (warnings.length > 0) {
    console.warn(`[env] Липсват препоръчани ключове:\n${warnings.map((w) => `  • ${w}`).join("\n")}`);
  }
}

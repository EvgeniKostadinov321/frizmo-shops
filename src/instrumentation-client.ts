/**
 * Sentry — браузър/клиент runtime. Зарежда се автоматично от Next.js в клиентския бъндъл.
 * DSN идва от NEXT_PUBLIC_SENTRY_DSN (публичен — вгражда се в бъндъла; липсва → Sentry е тихо
 * изключен, без грешка). Session Replay е НАРОЧНО изключен (тежък bundle + PII на купувачи;
 * решение 2026-07-25) — добавя се при нужда с replayIntegration().
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // 100% в dev, 10% на прод — пази безплатната quota.
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    // По подразбиране НЕ пращаме PII (IP/бисквитки/тела) — купувачите дават адреси/телефони.
    sendDefaultPii: false,
  });
}

// App Router навигационни spans (без това client tracing-ът е непълен).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

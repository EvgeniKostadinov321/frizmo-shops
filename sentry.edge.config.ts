/**
 * Sentry — Edge runtime (proxy.ts работи на edge). Зарежда се от instrumentation.ts при
 * NEXT_RUNTIME==="edge". DSN от SENTRY_DSN (липсва → тихо изключено).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    sendDefaultPii: false,
  });
}

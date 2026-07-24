/**
 * Sentry — Node.js сървър runtime. Зарежда се от instrumentation.ts при NEXT_RUNTIME==="nodejs".
 * DSN от SENTRY_DSN (сървърен env; липсва → тихо изключено). includeLocalVariables прикача
 * стойностите на локалните променливи към stack frame-овете (по-лесен debug на сървърни грешки).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    includeLocalVariables: true,
    // Купувачите подават адреси/телефони — не пращаме PII/тела по подразбиране.
    sendDefaultPii: false,
  });
}

/**
 * Строга валидация на български телефони — портната от Frizmo
 * (packages/shared/src/validation/phone.ts), с една адаптация:
 * стационарните номера са позволени по подразбиране (магазин може да има
 * стационарен телефон за връзка); `requireMobile: true` връща оригиналното
 * SMS-safe поведение за бъдещи auth/SMS потоци.
 */

export type PhoneParseResult =
  | { ok: true; e164: string }
  | { ok: false; reason: PhoneParseError };

export type PhoneParseError =
  | "empty"
  | "non_digit_chars"
  | "too_short"
  | "too_long"
  | "not_bulgarian"
  | "invalid_country_code"
  | "not_mobile";

export interface PhoneParseOptions {
  /** true → само мобилни (8x/9x) — за потоци, които пращат SMS. */
  requireMobile?: boolean;
}

const BG_MOBILE_FIRST_DIGIT = /^[89]/;

export function parseBgPhone(
  raw: string | null | undefined,
  options: PhoneParseOptions = {},
): PhoneParseResult {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "empty" };

  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (cleaned.length === 0) return { ok: false, reason: "empty" };
  if (!/^\+?\d+$/.test(cleaned)) return { ok: false, reason: "non_digit_chars" };

  let e164: string;
  if (cleaned.startsWith("+")) {
    e164 = cleaned;
  } else if (cleaned.startsWith("00359")) {
    e164 = "+" + cleaned.slice(2);
  } else if (cleaned.startsWith("00")) {
    e164 = "+" + cleaned.slice(2);
  } else if (cleaned.startsWith("359")) {
    e164 = "+" + cleaned;
  } else if (cleaned.startsWith("0")) {
    e164 = "+359" + cleaned.slice(1);
  } else {
    return { ok: false, reason: "invalid_country_code" };
  }

  if (e164.length < 8) return { ok: false, reason: "too_short" };
  if (e164.length > 16) return { ok: false, reason: "too_long" };

  if (e164.startsWith("+359")) {
    const subscriber = e164.slice(4);
    /* Мобилни: 9 цифри (88x/89x/98x...). Стационарни: 8 (София: 2+7) или 9 цифри. */
    if (subscriber.length < 8) return { ok: false, reason: "too_short" };
    if (subscriber.length > 9) return { ok: false, reason: "too_long" };
    if (options.requireMobile) {
      if (subscriber.length !== 9 || !BG_MOBILE_FIRST_DIGIT.test(subscriber)) {
        return { ok: false, reason: "not_mobile" };
      }
    }
    return { ok: true, e164 };
  }

  return { ok: false, reason: "not_bulgarian" };
}

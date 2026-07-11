import { randomInt } from "node:crypto";

/** Безопасна base32 азбука — без 0/O/1/I/L (лесни за объркване при препис). */
export const COUPON_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Генерира код `PREFIX-XXXXXX` (6 случайни символа). Уникалността се гарантира от викащия (retry). */
export function generateCouponCode(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += COUPON_CODE_ALPHABET[randomInt(COUPON_CODE_ALPHABET.length)];
  }
  return `${prefix.toUpperCase()}-${suffix}`;
}

import { createHmac, timingSafeEqual } from "node:crypto";

/** Центове (EUR) → ePay AMOUNT ("12.50" — 2 десетични, точка). */
export function toEpayAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** { KEY: VALUE } → base64 на редове „KEY=VALUE" (\n разделител, без крайен EOL). */
export function encodeData(fields: Record<string, string>): string {
  const data = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  return Buffer.from(data, "utf8").toString("base64");
}

/** base64 → { KEY: VALUE } (парсва „KEY=VALUE" редовете; стойности може да съдържат „="). */
export function decodeData(encoded: string): Record<string, string> {
  const data = Buffer.from(encoded, "base64").toString("utf8");
  const out: Record<string, string> = {};
  for (const line of data.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

/** base64 на HMAC-SHA1(encoded, secret) — форматът, който ePay очаква за CHECKSUM. */
export function hmacSha1(encoded: string, secret: string): string {
  return createHmac("sha1", secret).update(encoded).digest("base64");
}

/** Timing-safe сравнение на очаквания CHECKSUM с получения. */
export function verifyChecksum(encoded: string, checksum: string, secret: string): boolean {
  const expected = hmacSha1(encoded, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(checksum);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** ePay STATUS → вътрешен статус на payment_intent. */
export function mapEpayStatus(status: string): "paid" | "denied" | "expired" | "unknown" {
  switch (status.trim().toUpperCase()) {
    case "PAID":
      return "paid";
    case "DENIED":
      return "denied";
    case "EXPIRED":
      return "expired";
    default:
      return "unknown";
  }
}

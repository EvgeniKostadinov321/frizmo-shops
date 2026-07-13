import { describe, expect, it } from "vitest";
import {
  decodeData,
  encodeData,
  hmacSha1,
  mapEpayStatus,
  toEpayAmount,
  verifyChecksum,
} from "@/lib/payments/epay-signature";

describe("epay-signature", () => {
  it("toEpayAmount: центове → 2 десетични с точка", () => {
    expect(toEpayAmount(1250)).toBe("12.50");
    expect(toEpayAmount(2000)).toBe("20.00");
    expect(toEpayAmount(5)).toBe("0.05");
  });

  it("encodeData → base64, decodeData го връща обратно", () => {
    const fields = { MIN: "1234567890", INVOICE: "42", AMOUNT: "12.50" };
    const encoded = encodeData(fields);
    expect(typeof encoded).toBe("string");
    expect(decodeData(encoded)).toMatchObject(fields);
  });

  it("hmacSha1 е стабилен за същия вход", () => {
    const a = hmacSha1("ABC", "secret");
    const b = hmacSha1("ABC", "secret");
    expect(a).toBe(b);
    expect(hmacSha1("ABC", "other")).not.toBe(a);
  });

  it("verifyChecksum приема верен и отхвърля грешен подпис", () => {
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID" });
    const good = hmacSha1(encoded, "secret");
    expect(verifyChecksum(encoded, good, "secret")).toBe(true);
    expect(verifyChecksum(encoded, good, "wrong")).toBe(false);
    expect(verifyChecksum(encoded, "deadbeef", "secret")).toBe(false);
  });

  it("mapEpayStatus мапва познатите статуси", () => {
    expect(mapEpayStatus("PAID")).toBe("paid");
    expect(mapEpayStatus("DENIED")).toBe("denied");
    expect(mapEpayStatus("EXPIRED")).toBe("expired");
    expect(mapEpayStatus("WHATEVER")).toBe("unknown");
  });
});

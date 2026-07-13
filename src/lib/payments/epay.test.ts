import { describe, expect, it } from "vitest";
import { encodeData, hmacSha1 } from "@/lib/payments/epay-signature";
import { getPaymentProvider } from "@/lib/payments";

const CREDS = { kin: "1234567890", secret: "topsecret" };

describe("epay провайдър", () => {
  const epay = getPaymentProvider("epay");

  it("buildPackage връща actionUrl + подписан пакет", () => {
    const pkg = epay.buildPackage(
      {
        invoice: "42",
        amountCents: 1250,
        description: "Поръчка №42",
        expSeconds: 7200,
        urlOk: "https://x/ok",
        urlCancel: "https://x/cancel",
      },
      CREDS,
      "https://demo.epay.bg",
    );
    expect(pkg.actionUrl).toContain("demo.epay.bg");
    expect(pkg.fields.PAGE).toBe("paylogin");
    expect(pkg.fields.ENCODED).toBeTruthy();
    expect(pkg.fields.CHECKSUM).toBe(hmacSha1(pkg.fields.ENCODED, CREDS.secret));
    expect(pkg.fields.URL_OK).toBe("https://x/ok");
  });

  it("parseNotification валидира подписа и връща статуса", () => {
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" });
    const checksum = hmacSha1(encoded, CREDS.secret);
    const note = epay.parseNotification({ encoded, checksum }, CREDS);
    expect(note).not.toBeNull();
    expect(note!.invoice).toBe("42");
    expect(note!.status).toBe("paid");
    expect(note!.amountCents).toBe(1250);
  });

  it("parseNotification връща null при грешен подпис", () => {
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID" });
    const note = epay.parseNotification({ encoded, checksum: "bad" }, CREDS);
    expect(note).toBeNull();
  });
});

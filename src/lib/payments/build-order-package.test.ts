import { describe, expect, it } from "vitest";

/* Чистата логика на онлайн клона — helper в src/lib/ (НЕ в orders.ts, защото
   "use server" файл експортира само async функции). */
import { buildEpayForOrder } from "@/lib/payments/build-order-package";

describe("buildEpayForOrder", () => {
  it("строи пакет с INVOICE = orderNumber и сумата на поръчката", () => {
    const pkg = buildEpayForOrder({
      slug: "shop",
      orderId: "11111111-1111-4111-8111-111111111111",
      orderNumber: 42,
      totalCents: 1250,
      shopName: "Тест",
      creds: { kin: "1234567890", secret: "s3cr3t" },
      siteUrl: "https://x",
      apiBase: "https://demo.epay.bg",
      token: "22222222-2222-4222-8222-222222222222",
    });
    expect(pkg.fields.PAGE).toBe("paylogin");
    expect(pkg.fields.URL_OK).toContain(
      "/s/shop/order/11111111-1111-4111-8111-111111111111?paid=1",
    );
    expect(pkg.fields.ENCODED).toBeTruthy();
    expect(pkg.fields.CHECKSUM).toBeTruthy();
  });

  it("URL_OK носи ?t=<token> (иначе confirmation е 404 — S1-02)", () => {
    const pkg = buildEpayForOrder({
      slug: "shop",
      orderId: "11111111-1111-4111-8111-111111111111",
      orderNumber: 7,
      totalCents: 500,
      shopName: "Тест",
      creds: { kin: "1", secret: "s" },
      siteUrl: "https://x",
      apiBase: "https://demo.epay.bg",
      token: "22222222-2222-4222-8222-222222222222",
    });
    expect(pkg.fields.URL_OK).toContain("&t=22222222-2222-4222-8222-222222222222");
  });
});

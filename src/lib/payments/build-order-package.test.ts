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
    });
    expect(pkg.fields.PAGE).toBe("paylogin");
    expect(pkg.fields.URL_OK).toContain(
      "/s/shop/order/11111111-1111-4111-8111-111111111111?paid=1",
    );
    expect(pkg.fields.ENCODED).toBeTruthy();
    expect(pkg.fields.CHECKSUM).toBeTruthy();
  });
});

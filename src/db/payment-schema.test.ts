import { describe, expect, it } from "vitest";
import { paymentIntents, shopPaymentAccounts } from "@/db";
import { paymentTypeEnum } from "@/db/schema";

describe("payment схема", () => {
  it("shopPaymentAccounts има shopId + provider + credentials", () => {
    expect(shopPaymentAccounts.shopId).toBeDefined();
    expect(shopPaymentAccounts.provider).toBeDefined();
    expect(shopPaymentAccounts.credentials).toBeDefined();
  });
  it("paymentIntents има orderId + providerRef + amountCents + status", () => {
    expect(paymentIntents.orderId).toBeDefined();
    expect(paymentIntents.providerRef).toBeDefined();
    expect(paymentIntents.amountCents).toBeDefined();
    expect(paymentIntents.status).toBeDefined();
  });
  it("online_card е валиден платежен тип", () => {
    expect(paymentTypeEnum.enumValues).toContain("online_card");
  });
});

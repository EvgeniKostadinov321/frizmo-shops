import { describe, expect, it } from "vitest";
import { paymentAccountSchema } from "@/schemas/payment-account";

describe("paymentAccountSchema", () => {
  it("приема валиден KIN + secret", () => {
    const r = paymentAccountSchema.safeParse({ kin: "1234567890", secret: "s3cr3t" });
    expect(r.success).toBe(true);
  });
  it("отхвърля празен KIN", () => {
    expect(paymentAccountSchema.safeParse({ kin: "", secret: "s" }).success).toBe(false);
  });
  it("отхвърля празен secret", () => {
    expect(paymentAccountSchema.safeParse({ kin: "123", secret: "" }).success).toBe(false);
  });
});

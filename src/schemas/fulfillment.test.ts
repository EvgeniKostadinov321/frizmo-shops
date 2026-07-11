import { describe, expect, it } from "vitest";
import { paymentMethodSchema } from "./fulfillment";

describe("paymentMethodSchema — IBAN", () => {
  it("банков превод с валиден IBAN минава", () => {
    const r = paymentMethodSchema.safeParse({
      type: "bank_transfer",
      name: "Банка",
      details: "BG80 BNBG 9661 1020 3456 78",
    });
    expect(r.success).toBe(true);
  });
  it("банков превод с невалиден IBAN пада", () => {
    const r = paymentMethodSchema.safeParse({
      type: "bank_transfer",
      name: "Банка",
      details: "невалидно",
    });
    expect(r.success).toBe(false);
  });
  it("банков превод без IBAN пада", () => {
    const r = paymentMethodSchema.safeParse({ type: "bank_transfer", name: "Банка", details: "" });
    expect(r.success).toBe(false);
  });
  it("наложен платеж без IBAN минава (details свободен)", () => {
    const r = paymentMethodSchema.safeParse({ type: "cod", name: "Наложен платеж", details: "" });
    expect(r.success).toBe(true);
  });
});

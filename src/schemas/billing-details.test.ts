import { describe, it, expect } from "vitest";
import { billingDetailsSchema } from "./billing-details";

const base = {
  companyName: "Възраждане ЕООД",
  address: "ул. Охридски 1",
  city: "София",
  wantsInvoice: true,
};

describe("billingDetailsSchema — фирма", () => {
  it("приема валиден ЕИК (9 цифри) + МОЛ", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "123456789", mol: "Иван Петров" });
    expect(r.success).toBe(true);
  });

  it("приема ЕИК 13 цифри (клон)", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "1234567890123", mol: "Иван" });
    expect(r.success).toBe(true);
  });

  it("отхвърля невалиден ЕИК", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "12345", mol: "Иван" });
    expect(r.success).toBe(false);
  });

  it("иска МОЛ за фирма", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "123456789", mol: "" });
    expect(r.success).toBe(false);
  });
});

describe("billingDetailsSchema — физическо лице", () => {
  it("приема валиден ЕГН (10 цифри)", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "individual", egn: "7501010101" });
    expect(r.success).toBe(true);
  });

  it("отхвърля ЕГН с грешна дължина", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "individual", egn: "750101" });
    expect(r.success).toBe(false);
  });

  it("НЕ иска ЕИК за физическо лице", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "individual", egn: "7501010101", eik: "" });
    expect(r.success).toBe(true);
  });
});

describe("billingDetailsSchema — ДДС номер", () => {
  it("приема празен (по избор)", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "123456789", mol: "Иван", vatNumber: "" });
    expect(r.success).toBe(true);
  });

  it("приема валиден BG формат", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "123456789", mol: "Иван", vatNumber: "BG123456789" });
    expect(r.success).toBe(true);
  });

  it("отхвърля грешен формат", () => {
    const r = billingDetailsSchema.safeParse({ ...base, clientType: "company", eik: "123456789", mol: "Иван", vatNumber: "123456789" });
    expect(r.success).toBe(false);
  });
});

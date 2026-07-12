import { describe, expect, it } from "vitest";
import { addressSchema, buyerProfileSchema } from "@/schemas/buyer";

describe("addressSchema", () => {
  it("приема валиден адрес до врата", () => {
    const r = addressSchema.safeParse({
      label: "Вкъщи",
      receiverName: "Иван Иванов",
      receiverPhone: "0888123456",
      city: "София",
      address: "ул. Тест 1",
      isDefault: true,
    });
    expect(r.success).toBe(true);
  });
  it("отхвърля празно име на получател", () => {
    const r = addressSchema.safeParse({
      receiverName: "",
      receiverPhone: "0888123456",
      city: "София",
      address: "ул. Тест 1",
    });
    expect(r.success).toBe(false);
  });
  it("отхвърля невалиден телефон", () => {
    const r = addressSchema.safeParse({
      receiverName: "Иван",
      receiverPhone: "123",
      city: "София",
      address: "ул. Тест 1",
    });
    expect(r.success).toBe(false);
  });
});

describe("buyerProfileSchema", () => {
  it("приема име + телефон", () => {
    expect(
      buyerProfileSchema.safeParse({ fullName: "Иван Иванов", phone: "0888123456" }).success,
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { computeChecklist } from "./onboarding-status";

describe("computeChecklist", () => {
  it("всичко готово → 6/6, complete", () => {
    const r = computeChecklist({
      hasProduct: true,
      hasContacts: true,
      hasShipping: true,
      hasPayment: true,
      published: true,
    });
    expect(r.done).toBe(6);
    expect(r.total).toBe(6);
    expect(r.complete).toBe(true);
  });
  it("само магазин+продукт → 2/6, не complete", () => {
    const r = computeChecklist({
      hasProduct: true,
      hasContacts: false,
      hasShipping: false,
      hasPayment: false,
      published: false,
    });
    expect(r.done).toBe(2); // магазин + продукт
    expect(r.complete).toBe(false);
  });
});

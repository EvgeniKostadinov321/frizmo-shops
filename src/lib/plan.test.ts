import { describe, expect, it } from "vitest";
import { resolvePlan, billingAllowsSelling } from "./plan";

const DAY = 86_400_000;

describe("resolvePlan — trial по createdAt (без subscription)", () => {
  it("нов магазин в trial → pro", () => {
    const createdAt = new Date(Date.now() - 5 * DAY);
    expect(resolvePlan(null, createdAt)).toBe("pro");
  });
  it("изтекъл trial без subscription → starter", () => {
    const createdAt = new Date(Date.now() - 40 * DAY);
    expect(resolvePlan(null, createdAt)).toBe("starter");
  });
});

describe("resolvePlan — с subscription", () => {
  const base = { plan: "pro" as const, currentPeriodEnd: null, trialEndsAt: null };
  it("trialing → плана", () => {
    expect(resolvePlan({ ...base, status: "trialing" }, new Date())).toBe("pro");
  });
  it("active → плана", () => {
    expect(resolvePlan({ ...base, status: "active" }, new Date())).toBe("pro");
  });
  it("past_due → още плана (grace)", () => {
    expect(resolvePlan({ ...base, status: "past_due" }, new Date())).toBe("pro");
  });
  it("suspended → starter (fallback лимити)", () => {
    expect(resolvePlan({ ...base, status: "suspended" }, new Date())).toBe("starter");
  });
  it("canceled → starter", () => {
    expect(resolvePlan({ ...base, status: "canceled" }, new Date())).toBe("starter");
  });
});

describe("billingAllowsSelling", () => {
  const createdAt = new Date();
  it("trialing → продава", () => {
    expect(billingAllowsSelling({ status: "trialing" }, createdAt)).toBe(true);
  });
  it("active → продава", () => {
    expect(billingAllowsSelling({ status: "active" }, createdAt)).toBe(true);
  });
  it("past_due → още продава (grace)", () => {
    expect(billingAllowsSelling({ status: "past_due" }, createdAt)).toBe(true);
  });
  it("suspended → НЕ продава", () => {
    expect(billingAllowsSelling({ status: "suspended" }, createdAt)).toBe(false);
  });
  it("нов магазин без subscription в trial → продава", () => {
    expect(billingAllowsSelling(null, new Date(Date.now() - 5 * DAY))).toBe(true);
  });
  it("изтекъл trial без subscription → НЕ продава", () => {
    expect(billingAllowsSelling(null, new Date(Date.now() - 40 * DAY))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { registerSchema, TERMS_VERSION } from "./auth";

const base = {
  fullName: "Иван Петров",
  email: "ivan@gmail.com",
  password: "parola123",
};

describe("registerSchema — GDPR consent", () => {
  it("приема регистрация с прието съгласие", () => {
    const r = registerSchema.safeParse({ ...base, acceptTerms: true });
    expect(r.success).toBe(true);
  });

  it("ОТХВЪРЛЯ без прието съгласие (acceptTerms false)", () => {
    const r = registerSchema.safeParse({ ...base, acceptTerms: false });
    expect(r.success).toBe(false);
  });

  it("ОТХВЪРЛЯ ако acceptTerms липсва", () => {
    const r = registerSchema.safeParse({ ...base });
    expect(r.success).toBe(false);
  });

  it("marketing съгласието е по избор (default false)", () => {
    const r = registerSchema.safeParse({ ...base, acceptTerms: true });
    expect(r.success && r.data.acceptMarketing).toBe(false);
  });

  it("приема marketing съгласие когато е дадено", () => {
    const r = registerSchema.safeParse({ ...base, acceptTerms: true, acceptMarketing: true });
    expect(r.success && r.data.acceptMarketing).toBe(true);
  });

  it("TERMS_VERSION е дефинирана (за запис на съгласието)", () => {
    expect(typeof TERMS_VERSION).toBe("string");
    expect(TERMS_VERSION.length).toBeGreaterThan(0);
  });
});

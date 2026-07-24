import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildInvoicePayload, type InvBgBilling, type InvBgInvoiceData } from "./invbg";

const invoice: InvBgInvoiceData = {
  amountDueCents: 1234, // 12.34 €
  periodLabel: "2026-06",
  paidAt: new Date("2026-07-01T04:00:00.000Z"),
};

const company: InvBgBilling = {
  clientType: "company",
  companyName: "Възраждане ЕООД",
  eik: "123456789",
  mol: "Иван Петров",
  vatNumber: null,
  egn: null,
  address: "ул. Климент Охридски 125",
  city: "София",
};

const individual: InvBgBilling = {
  clientType: "individual",
  companyName: "Мария Иванова",
  eik: null,
  mol: null,
  vatNumber: null,
  egn: "7501010101",
  address: "бул. Витоша 1",
  city: "Пловдив",
};

describe("buildInvoicePayload — валута EUR + BGN", () => {
  it("подава EUR сумата на 2 знака", () => {
    const p = buildInvoicePayload(company, invoice);
    expect(p.payment_currency).toBe("EUR");
    expect(p.payment_amount).toBe(12.34);
    expect(p.payment_amount_total).toBe(12.34);
  });

  it("конвертира в BGN с фиксирания курс 1.95583", () => {
    const p = buildInvoicePayload(company, invoice);
    const main = p.main_currency as Record<string, number>;
    // 12.34 * 1.95583 = 24.1349... → 24.13
    expect(main.payment_amount).toBe(24.13);
    expect(main.payment_amount_total).toBe(24.13);
  });

  it("подава курса на конвертиране", () => {
    const p = buildInvoicePayload(company, invoice);
    expect(p.currency_rate).toBe(1.95583);
  });
});

describe("buildInvoicePayload — ДДС", () => {
  it("винаги 0% с правно основание чл.113 ал.9 ЗДДС", () => {
    const p = buildInvoicePayload(company, invoice);
    expect(p.vat).toEqual({ percent: 0, reason_without: "чл.113 ал.9 от ЗДДС" });
    expect(p.payment_amount_vat).toBe(0);
  });
});

describe("buildInvoicePayload — toggle фирма/физическо лице", () => {
  it("фирма → to_bulstat + to_mol, празни egn", () => {
    const p = buildInvoicePayload(company, invoice);
    expect(p.is_to_person).toBe(false);
    expect(p.to_bulstat).toBe("123456789");
    expect(p.to_mol).toBe("Иван Петров");
    expect(p.to_egn).toBe("");
  });

  it("физическо лице → to_egn, празни bulstat/mol", () => {
    const p = buildInvoicePayload(individual, invoice);
    expect(p.is_to_person).toBe(true);
    expect(p.to_egn).toBe("7501010101");
    expect(p.to_bulstat).toBe("");
    expect(p.to_mol).toBe("");
  });

  it("фирма без МОЛ → пада към името на фирмата", () => {
    const p = buildInvoicePayload({ ...company, mol: null }, invoice);
    expect(p.to_mol).toBe("Възраждане ЕООД");
  });
});

describe("buildInvoicePayload — общи полета", () => {
  it("склейва адрес + град", () => {
    const p = buildInvoicePayload(company, invoice);
    expect(p.to_address).toBe("ул. Климент Охридски 125, София");
    expect(p.to_country).toBe("BG");
  });

  it("описанието на реда съдържа периода", () => {
    const p = buildInvoicePayload(company, invoice);
    const items = p.items as Array<{ name: string; price: number; vat_percent: number }>;
    const item = items[0]!;
    expect(item.name).toContain("2026-06");
    expect(item.price).toBe(12.34);
    expect(item.vat_percent).toBe(0);
  });

  it("данъчна фактура, платена, с карта", () => {
    const p = buildInvoicePayload(company, invoice);
    expect(p.type).toBe("dan");
    expect(p.status).toBe("paid");
    expect(p.payment_method).toBe("card");
  });

  it("to_is_reg_vat отразява наличието на ДДС номер", () => {
    expect(buildInvoicePayload(company, invoice).to_is_reg_vat).toBe(false);
    expect(buildInvoicePayload({ ...company, vatNumber: "BG123456789" }, invoice).to_is_reg_vat).toBe(true);
  });
});

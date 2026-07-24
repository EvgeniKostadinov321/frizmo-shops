import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findFirst, updateSet, updateWhere, updateReturning, getBilling, createWithRetry } = vi.hoisted(
  () => ({
    findFirst: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn().mockResolvedValue(undefined),
    /* Atomic claim update-ът ползва .returning() — по подразбиране печели (1 ред). */
    updateReturning: vi.fn().mockResolvedValue([{ id: "fi-1" }]),
    getBilling: vi.fn(),
    createWithRetry: vi.fn(),
  }),
);

vi.mock("@/db", () => ({
  db: {
    query: { feeInvoices: { findFirst } },
    update: () => ({
      set: (payload: unknown) => {
        updateSet(payload);
        // where() е awaitable (обикновен update) + носи .returning() (atomic claim).
        const whereResult = Object.assign(Promise.resolve(undefined), { returning: updateReturning });
        return { where: () => whereResult };
      },
    }),
  },
  feeInvoices: { id: "id", invBgId: "invBgId", invBgStatus: "invBgStatus" },
  shops: { id: "id" },
}));
vi.mock("@/db/queries/billing-details", () => ({ getMerchantBillingDetails: getBilling }));
vi.mock("@/lib/invbg", () => ({ createInvBgInvoiceWithRetry: createWithRetry }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/email", () => ({ sendFeeInvoicePaidEmail: vi.fn() }));

import { issueInvBgForFeeInvoice } from "./invbg-issue";

const validInvoice = {
  id: "fi-1",
  shopId: "shop-1",
  amountDueCents: 1234,
  periodStart: new Date("2026-06-01T00:00:00Z"),
  invBgId: null,
};
const validBilling = {
  clientType: "company" as const,
  companyName: "Възраждане ЕООД",
  eik: "123456789",
  mol: "Иван",
  vatNumber: null,
  egn: null,
  address: "ул. 1",
  city: "София",
  wantsInvoice: true,
};

/** Форсираме prod чрез DI параметъра (не env). */
const prod = { forceProduction: true };

beforeEach(() => {
  vi.clearAllMocks();
  updateReturning.mockResolvedValue([{ id: "fi-1" }]); // по подразбиране claim-ът печели
});

describe("issueInvBgForFeeInvoice — skip условия", () => {
  it("skip ако фактурата не съществува", async () => {
    findFirst.mockResolvedValue(undefined);
    const r = await issueInvBgForFeeInvoice("fi-x", prod);
    expect(r).toEqual({ status: "skipped", reason: "no-invoice" });
    expect(createWithRetry).not.toHaveBeenCalled();
  });

  it("skip ако вече е издадена (idempotency)", async () => {
    findFirst.mockResolvedValue({ ...validInvoice, invBgId: 999 });
    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r).toEqual({ status: "skipped", reason: "already-issued" });
    expect(createWithRetry).not.toHaveBeenCalled();
  });

  it("skip при нулева/отрицателна сума", async () => {
    findFirst.mockResolvedValue({ ...validInvoice, amountDueCents: 0 });
    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r).toEqual({ status: "skipped", reason: "non-positive" });
  });

  it("skip ако няма данъчни данни (маркира skipped, не failed)", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(null);
    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r).toEqual({ status: "skipped", reason: "no-billing-details" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ invBgStatus: "skipped" }));
  });

  it("skip ако търговецът е отказал фактура", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue({ ...validBilling, wantsInvoice: false });
    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r).toEqual({ status: "skipped", reason: "opted-out" });
  });
});

describe("issueInvBgForFeeInvoice — prod-only гард", () => {
  it("skip извън production (без snapshot, без POST)", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(validBilling);
    // forceProduction: false → гардът блокира ПРЕДИ да пипне статуса (H2)
    const r = await issueInvBgForFeeInvoice("fi-1", { forceProduction: false });
    expect(r).toEqual({ status: "skipped", reason: "not-production" });
    expect(createWithRetry).not.toHaveBeenCalled();
    // H2: НЕ бива да оставя „pending" призрак на dev
    expect(updateSet).not.toHaveBeenCalledWith(expect.objectContaining({ invBgStatus: "pending" }));
  });
});

describe("issueInvBgForFeeInvoice — atomic claim (H1)", () => {
  it("skip ако друг event вече е заявил (claim губи)", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(validBilling);
    updateReturning.mockResolvedValue([]); // claim-ът връща 0 реда → загубил
    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r).toEqual({ status: "skipped", reason: "already-claimed" });
    expect(createWithRetry).not.toHaveBeenCalled(); // не POST-ва
  });
});

describe("issueInvBgForFeeInvoice — успешно издаване", () => {
  it("замразява snapshot (claim) + издава + записва резултата", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(validBilling);
    createWithRetry.mockResolvedValue({ id: 42, number: "0000000042", pdfLink: "https://inv.bg/pdf/42" });

    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r.status).toBe("issued");
    expect(r.issued).toMatchObject({ number: "0000000042", pdfLink: "https://inv.bg/pdf/42" });

    // snapshot freeze в claim-а
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ billingCompanyName: "Възраждане ЕООД", invBgStatus: "pending" }),
    );
    // резултатът записан
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ invBgId: 42, invBgNumber: "0000000042", invBgStatus: "issued" }),
    );
  });

  it("маркира failed при провал на inv.bg API", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(validBilling);
    createWithRetry.mockResolvedValue(null); // API провал след retries

    const r = await issueInvBgForFeeInvoice("fi-1", prod);
    expect(r).toEqual({ status: "failed", reason: "invbg-api" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ invBgStatus: "failed" }));
  });
});

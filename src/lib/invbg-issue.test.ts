import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findFirst, updateSet, updateWhere, getBilling, createWithRetry } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  getBilling: vi.fn(),
  createWithRetry: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: { feeInvoices: { findFirst } },
    update: () => ({
      set: (payload: unknown) => {
        updateSet(payload);
        return { where: updateWhere };
      },
    }),
  },
  feeInvoices: { id: "id" },
}));
vi.mock("@/db/queries/billing-details", () => ({ getMerchantBillingDetails: getBilling }));
vi.mock("@/lib/invbg", () => ({ createInvBgInvoiceWithRetry: createWithRetry }));

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

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VERCEL_ENV;
  process.env.INV_BG_FORCE = "1"; // симулираме production runtime за happy path
});

describe("issueInvBgForFeeInvoice — skip условия", () => {
  it("skip ако фактурата не съществува", async () => {
    findFirst.mockResolvedValue(undefined);
    const r = await issueInvBgForFeeInvoice("fi-x");
    expect(r).toEqual({ status: "skipped", reason: "no-invoice" });
    expect(createWithRetry).not.toHaveBeenCalled();
  });

  it("skip ако вече е издадена (idempotency)", async () => {
    findFirst.mockResolvedValue({ ...validInvoice, invBgId: 999 });
    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "skipped", reason: "already-issued" });
    expect(createWithRetry).not.toHaveBeenCalled();
  });

  it("skip при нулева/отрицателна сума", async () => {
    findFirst.mockResolvedValue({ ...validInvoice, amountDueCents: 0 });
    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "skipped", reason: "non-positive" });
  });

  it("skip ако няма данъчни данни", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(null);
    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "skipped", reason: "no-billing-details" });
  });

  it("skip ако търговецът е отказал фактура", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue({ ...validBilling, wantsInvoice: false });
    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "skipped", reason: "opted-out" });
  });
});

describe("issueInvBgForFeeInvoice — prod-only гард", () => {
  it("skip извън production (без реален POST)", async () => {
    delete process.env.INV_BG_FORCE; // не е prod
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(validBilling);
    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "skipped", reason: "not-production" });
    expect(createWithRetry).not.toHaveBeenCalled();
    // но snapshot-ът пак е записан (invBgStatus: pending)
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ invBgStatus: "pending" }));
  });
});

describe("issueInvBgForFeeInvoice — успешно издаване", () => {
  it("замразява snapshot + издава + записва резултата", async () => {
    findFirst.mockResolvedValue(validInvoice);
    getBilling.mockResolvedValue(validBilling);
    createWithRetry.mockResolvedValue({ id: 42, number: "0000000042", pdfLink: "https://inv.bg/pdf/42" });

    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "issued" });

    // snapshot freeze
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

    const r = await issueInvBgForFeeInvoice("fi-1");
    expect(r).toEqual({ status: "failed", reason: "invbg-api" });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ invBgStatus: "failed" }));
  });
});

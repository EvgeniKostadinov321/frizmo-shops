import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, requireShop, findFirst, findMany } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  requireShop: vi.fn(),
  findFirst: vi.fn().mockResolvedValue({ fullName: "Тест" }),
  findMany: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer, requireShop }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/db", () => ({
  db: {
    query: {
      profiles: { findFirst },
      orders: { findMany },
      buyerAddresses: { findMany },
      buyerFavorites: { findMany },
      buyerFavoriteShops: { findMany },
      merchantBillingDetails: { findFirst },
      feeInvoices: { findMany },
      feeEvents: { findMany },
      subscriptions: { findFirst },
      shops: { findFirst },
    },
  },
  buyerAddresses: {}, buyerFavorites: {}, buyerFavoriteShops: {}, feeEvents: {}, feeInvoices: {},
  merchantBillingDetails: {}, orders: {}, profiles: {}, shops: {}, subscriptions: {},
}));

import { exportBuyerData, exportMerchantData } from "./data-export";

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue({ fullName: "Тест" });
  findMany.mockResolvedValue([]);
  requireBuyer.mockResolvedValue({ user: { id: "buyer-1", email: "b@gmail.com" } });
  requireShop.mockResolvedValue({ user: { id: "seller-1", email: "s@gmail.com" }, shop: { id: "shop-1" } });
});

describe("exportBuyerData", () => {
  it("връща валиден JSON с обвивка subject=buyer", async () => {
    const json = await exportBuyerData();
    const parsed = JSON.parse(json);
    expect(parsed.subject).toBe("buyer");
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.data).toHaveProperty("profile");
    expect(parsed.data).toHaveProperty("orders");
    expect(parsed.data).toHaveProperty("favoriteProducts");
  });

  it("минава през requireBuyer (tenant изолация)", async () => {
    await exportBuyerData();
    expect(requireBuyer).toHaveBeenCalled();
  });
});

describe("exportMerchantData", () => {
  it("връща валиден JSON с обвивка subject=merchant", async () => {
    const json = await exportMerchantData();
    const parsed = JSON.parse(json);
    expect(parsed.subject).toBe("merchant");
    expect(parsed.data).toHaveProperty("shop");
    expect(parsed.data).toHaveProperty("billingDetails");
    expect(parsed.data).toHaveProperty("feeInvoices");
  });

  it("НЕ включва клиентски PII (без orders/subscribers на клиентите)", async () => {
    const json = await exportMerchantData();
    const parsed = JSON.parse(json);
    // Търговецът е обработващ на клиентските данни, не субект — те НЕ са в неговия експорт.
    expect(parsed.data).not.toHaveProperty("orders");
    expect(parsed.data).not.toHaveProperty("subscribers");
    expect(parsed.data).not.toHaveProperty("customers");
  });

  it("минава през requireShop (tenant изолация)", async () => {
    await exportMerchantData();
    expect(requireShop).toHaveBeenCalled();
  });
});

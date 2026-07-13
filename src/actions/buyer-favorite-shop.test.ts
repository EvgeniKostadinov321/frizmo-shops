import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, findFirst, findFirstProduct, insertValues } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  findFirst: vi.fn(),
  findFirstProduct: vi.fn(),
  insertValues: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db/queries/buyer", () => ({
  getBuyerFavoriteIds: vi.fn(),
  countGuestOrdersByPhone: vi.fn(),
}));
vi.mock("@/lib/account-deletion", () => ({ confirmDeleteWord: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    query: {
      buyerFavoriteShops: { findFirst },
      buyerFavorites: { findFirst: findFirstProduct },
    },
  },
  buyerFavoriteShops: { buyerId: "buyerId", shopId: "shopId" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
  buyerAddresses: {},
  profiles: {},
  orders: {},
  shops: { ownerId: "ownerId" },
}));

import { requireBuyer as rb } from "@/lib/auth";
import { toggleFavoriteProduct, toggleFavoriteShop } from "@/actions/buyer";

const SHOP = "4e44b8df-51e0-4dfa-b8f4-acd59307efa5";
const PRODUCT = "1b671a64-40d5-491e-99b0-da01ff1f3341";

describe("toggleFavoriteShop", () => {
  beforeEach(() => {
    (rb as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" },
      profile: { id: "b1" },
    });
    findFirst.mockReset();
  });
  it("добавя когато липсва", async () => {
    findFirst.mockResolvedValue(undefined);
    const res = await toggleFavoriteShop(SHOP);
    expect(res.ok && res.data.favorited).toBe(true);
  });
  it("маха когато има", async () => {
    findFirst.mockResolvedValue({ id: "f1", buyerId: "b1", shopId: SHOP });
    const res = await toggleFavoriteShop(SHOP);
    expect(res.ok && res.data.favorited).toBe(false);
  });
  it("отхвърля невалиден shopId", async () => {
    const res = await toggleFavoriteShop("bad");
    expect(res.ok).toBe(false);
  });
});

describe("toggleFavoriteProduct", () => {
  beforeEach(() => {
    (rb as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" },
      profile: { id: "b1" },
    });
    findFirstProduct.mockReset();
  });
  it("добавя когато липсва", async () => {
    findFirstProduct.mockResolvedValue(undefined);
    const res = await toggleFavoriteProduct(PRODUCT);
    expect(res.ok && res.data.favorited).toBe(true);
  });
  it("маха когато има", async () => {
    findFirstProduct.mockResolvedValue({ id: "f1", buyerId: "b1", productId: PRODUCT });
    const res = await toggleFavoriteProduct(PRODUCT);
    expect(res.ok && res.data.favorited).toBe(false);
  });
  it("отхвърля невалиден productId", async () => {
    const res = await toggleFavoriteProduct("bad");
    expect(res.ok).toBe(false);
  });
});

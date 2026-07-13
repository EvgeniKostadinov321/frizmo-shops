import { describe, expect, it, vi } from "vitest";

const { ordersFindMany, favShopFindMany } = vi.hoisted(() => ({
  ordersFindMany: vi.fn().mockResolvedValue([]),
  favShopFindMany: vi.fn().mockResolvedValue([{ shopId: "s1" }]),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => [] }) }) }),
    }),
    query: {
      orders: { findMany: ordersFindMany },
      buyerFavoriteShops: { findMany: favShopFindMany },
    },
  },
  orders: { buyerId: "buyerId", shopId: "shopId", createdAt: "createdAt" },
  shops: { id: "id", name: "name", slug: "slug" },
  products: { id: "id", shopId: "shopId", status: "status" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
  buyerFavoriteShops: { buyerId: "buyerId", shopId: "shopId", createdAt: "createdAt" },
}));

import { getBuyerFavoriteShopIds } from "@/db/queries/buyer-global";

describe("buyer-global queries", () => {
  it("getBuyerFavoriteShopIds връща само shopId-тата", async () => {
    const ids = await getBuyerFavoriteShopIds("b1");
    expect(ids).toEqual(["s1"]);
  });
});

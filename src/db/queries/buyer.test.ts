import { describe, expect, it, vi } from "vitest";

const { ordersFindMany, addrFindMany, favFindMany, productsFindMany } = vi.hoisted(() => ({
  ordersFindMany: vi.fn().mockResolvedValue([{ id: "o1" }]),
  addrFindMany: vi.fn().mockResolvedValue([{ id: "a1" }]),
  favFindMany: vi.fn().mockResolvedValue([{ productId: "p1" }, { productId: "p2" }]),
  productsFindMany: vi.fn().mockResolvedValue([{ id: "p1" }]),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: { findMany: ordersFindMany },
      buyerAddresses: { findMany: addrFindMany },
      buyerFavorites: { findMany: favFindMany },
      products: { findMany: productsFindMany },
    },
  },
  orders: { buyerId: "buyerId", shopId: "shopId", createdAt: "createdAt" },
  orderItems: {},
  buyerAddresses: { buyerId: "buyerId", isDefault: "isDefault", createdAt: "createdAt" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
  products: { id: "id", shopId: "shopId", status: "status" },
}));

import {
  getBuyerAddresses,
  getBuyerFavoriteIds,
  getBuyerFavoriteProducts,
  getBuyerOrders,
} from "@/db/queries/buyer";

describe("buyer queries", () => {
  it("getBuyerOrders вика findMany (филтрирано)", async () => {
    const res = await getBuyerOrders("b1", "s1");
    expect(ordersFindMany).toHaveBeenCalled();
    expect(res).toEqual([{ id: "o1" }]);
  });
  it("getBuyerAddresses вика findMany", async () => {
    await getBuyerAddresses("b1");
    expect(addrFindMany).toHaveBeenCalled();
  });
  it("getBuyerFavoriteIds връща само id-тата", async () => {
    const ids = await getBuyerFavoriteIds("b1");
    expect(ids).toEqual(["p1", "p2"]);
  });
  it("getBuyerFavoriteProducts празен списък → []", async () => {
    favFindMany.mockResolvedValueOnce([]);
    const res = await getBuyerFavoriteProducts("b1", "s1");
    expect(res).toEqual([]);
    expect(productsFindMany).not.toHaveBeenCalled();
  });
});

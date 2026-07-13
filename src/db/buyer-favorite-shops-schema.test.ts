import { describe, expect, it } from "vitest";
import { buyerFavoriteShops } from "@/db";

describe("buyerFavoriteShops схема", () => {
  it("има buyerId + shopId", () => {
    expect(buyerFavoriteShops.buyerId).toBeDefined();
    expect(buyerFavoriteShops.shopId).toBeDefined();
  });
});

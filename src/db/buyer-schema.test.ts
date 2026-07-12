import { describe, expect, it } from "vitest";
import { buyerAddresses, buyerFavorites, orders, profiles } from "@/db";

describe("купувачески данен модел", () => {
  it("profiles има preferredRole + phoneVerified", () => {
    expect(profiles.preferredRole).toBeDefined();
    expect(profiles.phoneVerified).toBeDefined();
  });
  it("orders има buyerId", () => {
    expect(orders.buyerId).toBeDefined();
  });
  it("buyerAddresses има куриерски офис полета", () => {
    expect(buyerAddresses.courierProvider).toBeDefined();
    expect(buyerAddresses.courierOfficeId).toBeDefined();
  });
  it("buyerFavorites е дефинирана", () => {
    expect(buyerFavorites.productId).toBeDefined();
  });
});

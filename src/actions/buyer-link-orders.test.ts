import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, updateWhere, countGuest } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  countGuest: vi.fn().mockResolvedValue(2),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db/queries/buyer", () => ({
  getBuyerFavoriteIds: vi.fn(),
  countGuestOrdersByPhone: countGuest,
}));
vi.mock("@/db", () => ({
  db: { update: () => ({ set: () => ({ where: updateWhere }) }) },
  orders: { buyerId: "buyerId", customerPhone: "customerPhone" },
  profiles: { id: "id" },
  buyerAddresses: { id: "id", buyerId: "buyerId" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
}));
vi.mock("@/lib/phone", () => ({ parseBgPhone: () => ({ ok: true, e164: "+359888123456" }) }));

import { linkGuestOrders } from "@/actions/buyer";

describe("linkGuestOrders", () => {
  beforeEach(() => {
    requireBuyer.mockResolvedValue({
      user: { id: "b1" },
      profile: { id: "b1", phone: "+359888123456" },
    });
    countGuest.mockResolvedValue(2);
  });

  it("свързва гост-поръчките по телефон", async () => {
    const res = await linkGuestOrders();
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.linked).toBe(2);
  });

  it("без телефон на профила → грешка", async () => {
    requireBuyer.mockResolvedValue({ user: { id: "b1" }, profile: { id: "b1", phone: null } });
    const res = await linkGuestOrders();
    expect(res.ok).toBe(false);
  });
});

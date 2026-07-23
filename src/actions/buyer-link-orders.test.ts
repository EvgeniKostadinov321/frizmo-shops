import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, updateWhere, countByEmail } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  countByEmail: vi.fn().mockResolvedValue(2),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db/queries/buyer", () => ({
  getBuyerFavoriteIds: vi.fn(),
  countGuestOrdersByEmail: countByEmail,
}));
vi.mock("@/db", () => ({
  db: { update: () => ({ set: () => ({ where: updateWhere }) }) },
  orders: { buyerId: "buyerId", customerEmail: "customerEmail" },
  profiles: { id: "id" },
  buyerAddresses: { id: "id", buyerId: "buyerId" },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
  buyerFavoriteShops: { buyerId: "buyerId", shopId: "shopId" },
  shops: { id: "id" },
}));
vi.mock("@/lib/phone", () => ({ parseBgPhone: () => ({ ok: true, e164: "+359888123456" }) }));

import { linkGuestOrders } from "@/actions/buyer";

describe("linkGuestOrders (по верифициран имейл — SEC-01)", () => {
  beforeEach(() => {
    requireBuyer.mockResolvedValue({
      user: { id: "b1", email: "buyer@gmail.com" },
      profile: { id: "b1", phone: "+359888123456" },
    });
    countByEmail.mockResolvedValue(2);
    updateWhere.mockClear();
  });

  it("свързва гост-поръчките по имейла на акаунта", async () => {
    const res = await linkGuestOrders();
    expect(res.ok).toBe(true);
    expect(res.ok && res.data.linked).toBe(2);
    // мачът е по имейл, не по телефон
    expect(countByEmail).toHaveBeenCalledWith("buyer@gmail.com");
  });

  it("НЕ вдига phoneVerified (беше фалшива верификация) — само orders се update-ва веднъж", async () => {
    await linkGuestOrders();
    // единствен update = orders (по-рано имаше втори update на profiles.phoneVerified)
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it("без имейл на акаунта → грешка (не свързва нищо)", async () => {
    requireBuyer.mockResolvedValue({ user: { id: "b1", email: null }, profile: { id: "b1", phone: null } });
    const res = await linkGuestOrders();
    expect(res.ok).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, shopFindFirst, updateWhere, deleteWhere, deleteUser, signOut } = vi.hoisted(
  () => ({
    requireBuyer: vi.fn(),
    shopFindFirst: vi.fn(),
    updateWhere: vi.fn().mockResolvedValue(undefined),
    deleteWhere: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
);

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db/queries/buyer", () => ({
  getBuyerFavoriteIds: vi.fn(),
  countGuestOrdersByPhone: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => ({ auth: { admin: { deleteUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => ({ auth: { signOut } }),
}));
vi.mock("@/db", () => ({
  db: {
    query: { shops: { findFirst: shopFindFirst }, buyerFavoriteShops: { findFirst: vi.fn() } },
    update: () => ({ set: () => ({ where: updateWhere }) }),
    delete: () => ({ where: deleteWhere }),
    insert: () => ({ values: () => ({ onConflictDoNothing: vi.fn() }) }),
    /* P4-01: DB стъпките на изтриването сега са в транзакция → tx има същия shape. */
    transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        update: () => ({ set: () => ({ where: updateWhere }) }),
        delete: () => ({ where: deleteWhere }),
      }),
  },
  shops: { ownerId: "ownerId" },
  orders: { buyerId: "buyerId" },
  buyerAddresses: { buyerId: "buyerId" },
  buyerFavorites: { buyerId: "buyerId" },
  buyerFavoriteShops: { buyerId: "buyerId" },
  profiles: { id: "id" },
}));

import { requireBuyer as rb } from "@/lib/auth";
import { deleteBuyerAccount } from "@/actions/buyer";

describe("deleteBuyerAccount", () => {
  beforeEach(() => {
    (rb as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      user: { id: "b1" },
      profile: { id: "b1" },
    });
    shopFindFirst.mockReset();
    deleteUser.mockClear();
  });

  it("отхвърля грешна потвърдителна дума", async () => {
    shopFindFirst.mockResolvedValue(undefined);
    const res = await deleteBuyerAccount({ confirm: "не" });
    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("гард: има магазин → отказ", async () => {
    shopFindFirst.mockResolvedValue({ id: "shop1" });
    const res = await deleteBuyerAccount({ confirm: "ИЗТРИЙ" });
    expect(res.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("валидно → трие auth юзъра", async () => {
    shopFindFirst.mockResolvedValue(undefined);
    const res = await deleteBuyerAccount({ confirm: "ИЗТРИЙ" });
    expect(res.ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("b1");
  });
});

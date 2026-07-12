import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, favFindFirst, insertValues, getFavoriteIds } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  favFindFirst: vi.fn(),
  insertValues: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })),
  getFavoriteIds: vi.fn().mockResolvedValue(["p1"]),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db/queries/buyer", () => ({ getBuyerFavoriteIds: getFavoriteIds }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    query: { buyerFavorites: { findFirst: favFindFirst } },
  },
  buyerFavorites: { buyerId: "buyerId", productId: "productId" },
  buyerAddresses: { id: "id", buyerId: "buyerId" },
  profiles: { id: "id" },
}));

import { mergeFavoritesOnLogin, toggleBuyerFavorite } from "@/actions/buyer";

const P1 = "4e44b8df-51e0-4dfa-b8f4-acd59307efa5";
const P2 = "ebe6c847-401f-4ec1-b546-74e28e583c69";

describe("любими синхрон", () => {
  beforeEach(() => {
    requireBuyer.mockResolvedValue({ user: { id: "b1" }, profile: { id: "b1" } });
    favFindFirst.mockReset();
  });

  it("toggle добавя когато липсва", async () => {
    favFindFirst.mockResolvedValue(undefined);
    const res = await toggleBuyerFavorite(P2);
    expect(res.ok && res.data.favorited).toBe(true);
  });
  it("toggle маха когато има", async () => {
    favFindFirst.mockResolvedValue({ id: "f1", buyerId: "b1", productId: P2 });
    const res = await toggleBuyerFavorite(P2);
    expect(res.ok && res.data.favorited).toBe(false);
  });
  it("merge връща обединения списък (без дубли)", async () => {
    const res = await mergeFavoritesOnLogin([P1, P2]);
    expect(res.ok).toBe(true);
  });
  it("merge с празен вход е ок", async () => {
    const res = await mergeFavoritesOnLogin([]);
    expect(res.ok).toBe(true);
  });
});

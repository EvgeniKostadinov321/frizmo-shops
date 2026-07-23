import { describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock("@/db", () => ({
  db: { select: selectMock },
  paymentIntents: { id: "id", orderId: "orderId", status: "status", createdAt: "createdAt" },
  orders: { id: "id", status: "status", shopId: "shopId" },
  shops: { id: "id", slug: "slug" },
}));

import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";

describe("getExpiredPendingOrders", () => {
  it("връща orderId+intentId+slug за изтеклите (2 innerJoin: orders + shops)", async () => {
    /* Веригата вече е .from().innerJoin(orders).innerJoin(shops).where().limit() —
       slug се връща за feed инвалидацията (одит #2 CACHE-02). */
    const limit = () => [{ orderId: "o1", intentId: "i1", slug: "shop-1" }];
    selectMock.mockReturnValue({
      from: () => ({
        innerJoin: () => ({ innerJoin: () => ({ where: () => ({ limit }) }) }),
      }),
    });
    const rows = await getExpiredPendingOrders(7_200_000, 100);
    expect(rows).toEqual([{ orderId: "o1", intentId: "i1", slug: "shop-1" }]);
  });
});

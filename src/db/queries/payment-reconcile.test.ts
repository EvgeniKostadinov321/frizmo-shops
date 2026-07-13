import { describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock("@/db", () => ({
  db: { select: selectMock },
  paymentIntents: { id: "id", orderId: "orderId", status: "status", createdAt: "createdAt" },
  orders: { id: "id", status: "status" },
}));

import { getExpiredPendingOrders } from "@/db/queries/payment-reconcile";

describe("getExpiredPendingOrders", () => {
  it("връща orderId+intentId за изтеклите", async () => {
    selectMock.mockReturnValue({
      from: () => ({
        innerJoin: () => ({ where: () => ({ limit: () => [{ orderId: "o1", intentId: "i1" }] }) }),
      }),
    });
    const rows = await getExpiredPendingOrders(7_200_000, 100);
    expect(rows).toEqual([{ orderId: "o1", intentId: "i1" }]);
  });
});

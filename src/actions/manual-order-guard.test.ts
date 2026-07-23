import { beforeEach, describe, expect, it, vi } from "vitest";

/* Card-gate дупка (одит 2026-07-23): createManualOrder е НОВА продажба, значи трябва
   да минава през същия canAcceptOrders гард като createOrder. Иначе търговецът
   заобикаля card-gate-а, добавяйки продажби ръчно. Този тест пази гарда от регресия. */

const { requireShop, canAcceptOrders, insertSpy } = vi.hoisted(() => ({
  requireShop: vi.fn(),
  canAcceptOrders: vi.fn(),
  insertSpy: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireShop }));
vi.mock("@/lib/selling-gate", () => ({ canAcceptOrders, requiresCard: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    query: {
      shippingMethods: { findFirst: vi.fn() },
      paymentMethods: { findFirst: vi.fn() },
    },
    insert: insertSpy,
    transaction: vi.fn(),
  },
  orders: {},
  orderItems: {},
  products: {},
  shippingMethods: {},
  paymentMethods: {},
}));
vi.mock("@/db/queries/fees", () => ({ recordFeeCharge: vi.fn(), recordFeeCredit: vi.fn(), countFeeCharges: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendOrderEmails: vi.fn(),
  sendOrderStatusEmail: vi.fn(),
  sendReturnRequestEmail: vi.fn(),
  sendCardRequiredEmail: vi.fn(),
}));
vi.mock("@/lib/push", () => ({ sendNewOrderPush: vi.fn(), sendPushToUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/db/queries/storefront", () => ({ shopCacheTag: () => "tag" }));

import { createManualOrder } from "@/actions/orders";

const VALID_INPUT = {
  customerName: "Иван Петров",
  customerPhone: "0888123456",
  shippingMethodId: "a1b2c3d4-1111-4111-8111-111111111111",
  paymentMethodId: "a1b2c3d4-2222-4222-8222-222222222222",
  lines: [
    { productId: "a1b2c3d4-3333-4333-8333-333333333333", variantKey: null, qty: 1 },
  ],
};

describe("createManualOrder — card-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireShop.mockResolvedValue({ shop: { id: "shop-1", slug: "s", name: "S" }, user: { id: "u" } });
  });

  it("блокира ръчна поръчка когато canAcceptOrders=false (не създава, не insert-ва)", async () => {
    canAcceptOrders.mockResolvedValue(false);
    const res = await createManualOrder(VALID_INPUT);
    expect(res.ok).toBe(false);
    expect(canAcceptOrders).toHaveBeenCalledWith("shop-1");
    expect(insertSpy).not.toHaveBeenCalled(); // гардът спира ПРЕДИ всякакъв insert
  });
});

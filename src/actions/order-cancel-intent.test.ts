import { beforeEach, describe, expect, it, vi } from "vitest";

/* S3-01: ръчен отказ на pending_payment поръчка трябва да маркира и
   payment_intents.status = "expired" в същата транзакция, иначе закъсняла PAID
   нотификация минава webhook guard-а (intent=pending) и възкресява поръчката. */

const {
  requireShop,
  orderFindFirst,
  ordersUpdateWhere,
  intentsUpdateWhere,
  itemsFindMany,
  ORDERS,
  PAYMENT_INTENTS,
} = vi.hoisted(() => ({
  requireShop: vi.fn(),
  orderFindFirst: vi.fn(),
  /* orders update е CAS: .where(...).returning() → връща [{id}] = успял преход
     (непразен → изпълнява restoreStock/такси/intent). */
  ordersUpdateWhere: vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: "o1" }]) }),
  intentsUpdateWhere: vi.fn().mockResolvedValue(undefined),
  /* restoreStock (реалният, не мокнат) чете order_items през tx → празен масив,
     за да не пипа продукти/варианти в теста. */
  itemsFindMany: vi.fn().mockResolvedValue([]),
  /* Разграничаваме коя таблица се update-ва по идентичността на подадения обект. */
  ORDERS: { id: "orders.id" },
  PAYMENT_INTENTS: { id: "paymentIntents.id", orderId: "paymentIntents.orderId" },
}));

function makeTx() {
  return {
    query: { orderItems: { findMany: itemsFindMany } },
    update: (table: unknown) => ({
      set: () => ({
        where: table === PAYMENT_INTENTS ? intentsUpdateWhere : ordersUpdateWhere,
      }),
    }),
  };
}

vi.mock("@/lib/auth", () => ({ requireShop }));
vi.mock("@/db", () => ({
  db: {
    query: { orders: { findFirst: orderFindFirst } },
    transaction: (fn: (tx: unknown) => unknown) => fn(makeTx()),
  },
  orders: ORDERS,
  paymentIntents: PAYMENT_INTENTS,
  orderItems: {},
  productVariants: {},
  products: {},
  coupons: {},
  referrals: {},
  shippingMethods: {},
  shippingZones: {},
  shopPaymentAccounts: {},
  shops: {},
  paymentMethods: {},
}));
vi.mock("@/lib/email", () => ({
  sendOrderEmails: vi.fn(),
  sendOrderStatusEmail: vi.fn(),
  sendReturnRequestEmail: vi.fn(),
}));
vi.mock("@/lib/push", () => ({ sendNewOrderPush: vi.fn(), sendPushToUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/db/queries/storefront", () => ({ shopCacheTag: () => "tag" }));
/* selling-gate е server-only (Stripe) + fees прави реални DB заявки — mock-ваме ги,
   този тест е за intent логиката при cancel, не за таксите. */
vi.mock("@/lib/selling-gate", () => ({ canAcceptOrders: vi.fn().mockResolvedValue(true) }));
vi.mock("@/db/queries/fees", () => ({ recordFeeCharge: vi.fn(), recordFeeCredit: vi.fn() }));

import { updateOrderStatus } from "@/actions/orders";

describe("updateOrderStatus — S3-01 intent при cancel", () => {
  beforeEach(() => {
    requireShop.mockResolvedValue({ shop: { id: "s1", slug: "shop" } });
    orderFindFirst.mockReset();
    ordersUpdateWhere.mockClear();
    intentsUpdateWhere.mockClear();
    itemsFindMany.mockClear();
  });

  it("cancel на pending_payment → маркира и intent-а expired", async () => {
    orderFindFirst.mockResolvedValue({
      id: "o1",
      shopId: "s1",
      status: "pending_payment",
      orderNumber: 1,
      customerEmail: "",
    });
    const res = await updateOrderStatus({ id: "11111111-1111-4111-8111-111111111111", status: "cancelled" });
    expect(res.ok).toBe(true);
    expect(intentsUpdateWhere).toHaveBeenCalledTimes(1); // intent-ът е отменен
  });

  it("cancel на обикновена (new) поръчка → НЕ пипа intent", async () => {
    orderFindFirst.mockResolvedValue({
      id: "o2",
      shopId: "s1",
      status: "new",
      orderNumber: 2,
      customerEmail: "",
    });
    const res = await updateOrderStatus({ id: "11111111-1111-4111-8111-111111111111", status: "cancelled" });
    expect(res.ok).toBe(true);
    expect(intentsUpdateWhere).not.toHaveBeenCalled();
  });

  /* DATA-01 (одит 2026-07-23): при двоен клик второто изпълнение получава празен RETURNING
     (първото вече е сменило статуса) → CAS прекратява БЕЗ restoreStock/intent update. */
  it("CAS: празен RETURNING (друг вече е сменил статуса) → НЕ restore-ва/пипа intent, връща ok", async () => {
    orderFindFirst.mockResolvedValue({
      id: "o3",
      shopId: "s1",
      status: "pending_payment",
      orderNumber: 3,
      customerEmail: "",
    });
    ordersUpdateWhere.mockReturnValueOnce({ returning: () => Promise.resolve([]) }); // загубил CAS-а
    const res = await updateOrderStatus({ id: "11111111-1111-4111-8111-111111111111", status: "cancelled" });
    expect(res.ok).toBe(true); // исканото състояние вече е постигнато от другия
    expect(intentsUpdateWhere).not.toHaveBeenCalled(); // прескочено — без двойно действие
  });
});

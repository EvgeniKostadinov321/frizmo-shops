import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeData, hmacSha1 } from "@/lib/payments/epay-signature";

const { intentFindMany, txUpdateWhere, txSet, restoreStock, getShopPaymentAccount } = vi.hoisted(
  () => ({
    intentFindMany: vi.fn(),
    txUpdateWhere: vi.fn().mockResolvedValue(undefined),
    /* Записва payload-а на всеки .set() в транзакцията → тестът вижда КОЙ intent
       е бил обновен и с какъв статус (multi-tenant изолация). */
    txSet: vi.fn(),
    restoreStock: vi.fn().mockResolvedValue(undefined),
    /* По подразбиране: един магазин с secret „s3cr3t". Multi-tenant тестът го
       презаписва да връща различен secret според shopId. */
    getShopPaymentAccount: vi.fn().mockResolvedValue({ credentials: { kin: "1", secret: "s3cr3t" } }),
  }),
);

vi.mock("@/db", () => ({
  db: {
    query: { paymentIntents: { findMany: intentFindMany } },
    transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        update: () => ({
          set: (payload: unknown) => {
            txSet(payload);
            return { where: txUpdateWhere };
          },
        }),
      }),
    /* feed-инвалидацията (CACHE-02) резолвва slug: db.select().from().innerJoin().where().limit() */
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: () => ({ limit: () => [{ slug: "shop-1" }] }) }),
      }),
    }),
  },
  paymentIntents: { providerRef: "providerRef", id: "id", status: "status" },
  orders: { id: "id", status: "status", shopId: "shopId" },
  shops: { id: "id", slug: "slug" },
  shopPaymentAccounts: {},
}));
vi.mock("@/actions/orders", () => ({ restoreStock }));
vi.mock("@/db/queries/payment-accounts", () => ({ getShopPaymentAccount }));
vi.mock("@/db/queries/storefront", () => ({ shopCacheTag: (s: string) => `shop:${s}` }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { confirmEpayPayment } from "@/actions/payment-confirm";

const SECRET = "s3cr3t";

function notif(fields: Record<string, string>) {
  const encoded = encodeData(fields);
  return { encoded, checksum: hmacSha1(encoded, SECRET) };
}

describe("confirmEpayPayment", () => {
  beforeEach(() => {
    intentFindMany.mockReset();
    txUpdateWhere.mockClear();
    txSet.mockClear();
    restoreStock.mockClear();
    getShopPaymentAccount.mockReset();
    getShopPaymentAccount.mockResolvedValue({ credentials: { kin: "1", secret: SECRET } });
  });

  it("невалиден подпис → invalid, нищо не се обновява", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment({
      encoded: notif({ INVOICE: "42", STATUS: "PAID" }).encoded,
      checksum: "bad",
    });
    expect(res.result).toBe("invalid");
    expect(txUpdateWhere).not.toHaveBeenCalled();
  });

  it("PAID → потвърждава (ok)", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" }));
    expect(res.result).toBe("ok");
  });

  it("вече paid → ignored (идемпотентност)", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "paid" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" }));
    expect(res.result).toBe("ignored");
  });

  it("подправена сума → invalid", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "PAID", AMOUNT: "99.00" }));
    expect(res.result).toBe("invalid");
  });

  it("EXPIRED → отменя + restock", async () => {
    intentFindMany.mockResolvedValue([
      { id: "i1", orderId: "o1", shopId: "s1", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    const res = await confirmEpayPayment(notif({ INVOICE: "42", STATUS: "EXPIRED", AMOUNT: "12.50" }));
    expect(res.result).toBe("ok");
    expect(restoreStock).toHaveBeenCalled();
  });

  /* S1-04 / S3-05 — регресия за S1-01: `providerRef` (orderNumber) е per-магазин, НЕ
     глобален. Два магазина може да имат поръчка №42. Нотификация, подписана със secret-а
     на магазин А, трябва да потвърди САМО интента на А — интентът на Б (различен secret)
     остава непокътнат. Гаранцията идва от unique индекса (shopId, provider, providerRef) +
     verify-per-candidate в confirmEpayPayment. */
  it("два магазина, еднакъв orderNumber → потвърждава само магазина с валидния подпис", async () => {
    const SECRET_A = "secretA";
    const SECRET_B = "secretB";
    /* Кандидатите се връщат от findMany по providerRef=42 (и двата магазина). */
    intentFindMany.mockResolvedValue([
      { id: "i-B", orderId: "o-B", shopId: "sB", providerRef: "42", amountCents: 5000, status: "pending" },
      { id: "i-A", orderId: "o-A", shopId: "sA", providerRef: "42", amountCents: 1250, status: "pending" },
    ]);
    /* Всеки магазин има собствен secret. */
    getShopPaymentAccount.mockImplementation(async (shopId: string) => ({
      credentials: { kin: "1", secret: shopId === "sA" ? SECRET_A : SECRET_B },
    }));

    /* Нотификацията е подписана със secret-а на магазин А. */
    const encoded = encodeData({ INVOICE: "42", STATUS: "PAID", AMOUNT: "12.50" });
    const res = await confirmEpayPayment({ encoded, checksum: hmacSha1(encoded, SECRET_A) });

    expect(res.result).toBe("ok");
    /* Обновени са само записите на А (intent + поръчка) — Б изобщо не влиза в транзакция:
       единственият paid-статус идва от потвърждаването на А. */
    const paidCalls = txSet.mock.calls.filter(([p]) => (p as { status?: string }).status === "paid");
    expect(paidCalls).toHaveLength(1);
    /* Поръчката на А става „new"; никъде не се пипа „cancelled"/restock (Б остава pending). */
    expect(txSet.mock.calls.some(([p]) => (p as { status?: string }).status === "new")).toBe(true);
    expect(restoreStock).not.toHaveBeenCalled();
  });
});

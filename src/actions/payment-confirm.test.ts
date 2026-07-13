import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeData, hmacSha1 } from "@/lib/payments/epay-signature";

const { intentFindMany, txUpdateWhere, restoreStock } = vi.hoisted(() => ({
  intentFindMany: vi.fn(),
  txUpdateWhere: vi.fn().mockResolvedValue(undefined),
  restoreStock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db", () => ({
  db: {
    query: { paymentIntents: { findMany: intentFindMany } },
    transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        update: () => ({ set: () => ({ where: txUpdateWhere }) }),
      }),
  },
  paymentIntents: { providerRef: "providerRef", id: "id", status: "status" },
  orders: { id: "id", status: "status" },
  shopPaymentAccounts: {},
}));
vi.mock("@/actions/orders", () => ({ restoreStock }));
vi.mock("@/db/queries/payment-accounts", () => ({
  getShopPaymentAccount: vi.fn().mockResolvedValue({ credentials: { kin: "1", secret: "s3cr3t" } }),
}));

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
    restoreStock.mockClear();
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
});

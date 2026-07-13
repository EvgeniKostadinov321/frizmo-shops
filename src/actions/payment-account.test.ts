import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireShop, insertValues, onConflict, deleteWhere } = vi.hoisted(() => ({
  requireShop: vi.fn(),
  onConflict: vi.fn().mockResolvedValue(undefined),
  insertValues: vi.fn(),
  deleteWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({ requireShop }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: deleteWhere }),
  },
  shopPaymentAccounts: { shopId: "shopId", provider: "provider" },
}));

import { requireShop as rs } from "@/lib/auth";
import { savePaymentAccount, deletePaymentAccount } from "@/actions/payment-account";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

describe("savePaymentAccount", () => {
  beforeEach(() => {
    (rs as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      shop: { id: "shop1" },
    });
    insertValues.mockReset().mockReturnValue({ onConflictDoUpdate: onConflict });
    onConflict.mockClear();
  });

  it("записва валиден акаунт (upsert)", async () => {
    const res = await savePaymentAccount({}, fd({ kin: "1234567890", secret: "s3cr3t" }));
    expect(res.ok).toBe(true);
    expect(insertValues).toHaveBeenCalled();
  });

  it("отхвърля празен KIN", async () => {
    const res = await savePaymentAccount({}, fd({ kin: "", secret: "s" }));
    expect(res.error).toBeTruthy();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("deletePaymentAccount трие по shop+provider", async () => {
    await deletePaymentAccount();
    expect(deleteWhere).toHaveBeenCalled();
  });
});

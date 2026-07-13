import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireBuyer, insertValues, findFirst } = vi.hoisted(() => ({
  requireBuyer: vi.fn(),
  insertValues: vi.fn(() => ({ returning: () => [{ id: "a1" }] })),
  findFirst: vi.fn().mockResolvedValue({ id: "a1", buyerId: "b1" }),
}));

vi.mock("@/lib/auth", () => ({ requireBuyer }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/actions/cart", () => ({ clientIp: vi.fn().mockResolvedValue("1.1.1.1") }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    query: { buyerAddresses: { findFirst } },
  },
  buyerAddresses: { id: "id", buyerId: "buyerId", isDefault: "isDefault" },
}));

import { saveAddress } from "@/actions/buyer";

describe("saveAddress", () => {
  beforeEach(() => {
    requireBuyer.mockResolvedValue({ user: { id: "b1" }, profile: { id: "b1" } });
    insertValues.mockClear();
  });

  it("създава адрес при валиден вход", async () => {
    const res = await saveAddress({
      receiverName: "Иван Иванов",
      receiverPhone: "0888123456",
      city: "София",
      address: "ул. Тест 1",
    });
    expect(res.ok).toBe(true);
    expect(insertValues).toHaveBeenCalled();
  });

  it("отхвърля невалиден вход", async () => {
    const res = await saveAddress({ receiverName: "", receiverPhone: "x", city: "", address: "" });
    expect(res.ok).toBe(false);
  });
});

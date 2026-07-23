import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/queries/fees", () => ({
  hasOverdueFees: vi.fn(),
  cardState: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  customerHasDefaultCard: vi.fn(),
}));

import { canAcceptOrders, requiresCard } from "./selling-gate";
import { hasOverdueFees, cardState } from "@/db/queries/fees";
import { customerHasDefaultCard } from "@/lib/stripe";

describe("requiresCard", () => {
  beforeEach(() => vi.resetAllMocks());

  it("false, ако още няма таксуема продажба (без charge)", async () => {
    vi.mocked(cardState).mockResolvedValue({ hasCharge: false, customerId: null });
    expect(await requiresCard("shop-1")).toBe(false);
  });

  it("true при charge без Stripe Customer", async () => {
    vi.mocked(cardState).mockResolvedValue({ hasCharge: true, customerId: null });
    expect(await requiresCard("shop-1")).toBe(true);
  });

  it("true при charge + Customer, но без запазена карта", async () => {
    vi.mocked(cardState).mockResolvedValue({ hasCharge: true, customerId: "cus_1" });
    vi.mocked(customerHasDefaultCard).mockResolvedValue(false);
    expect(await requiresCard("shop-1")).toBe(true);
  });

  it("false при charge + Customer + запазена карта", async () => {
    vi.mocked(cardState).mockResolvedValue({ hasCharge: true, customerId: "cus_1" });
    vi.mocked(customerHasDefaultCard).mockResolvedValue(true);
    expect(await requiresCard("shop-1")).toBe(false);
  });
});

describe("canAcceptOrders", () => {
  beforeEach(() => vi.resetAllMocks());

  it("true за нов магазин без такси и без изискана карта", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(false);
    vi.mocked(cardState).mockResolvedValue({ hasCharge: false, customerId: null });
    expect(await canAcceptOrders("shop-1")).toBe(true);
  });

  it("false при просрочена фактура", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(true);
    vi.mocked(cardState).mockResolvedValue({ hasCharge: false, customerId: null });
    expect(await canAcceptOrders("shop-1")).toBe(false);
  });

  it("false когато се изисква карта (charge без карта)", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(false);
    vi.mocked(cardState).mockResolvedValue({ hasCharge: true, customerId: null });
    expect(await canAcceptOrders("shop-1")).toBe(false);
  });
});

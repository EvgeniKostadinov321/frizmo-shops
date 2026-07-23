import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/queries/fees", () => ({
  hasOverdueFees: vi.fn(),
  requiresCard: vi.fn(),
}));

import { canAcceptOrders } from "./selling-gate";
import { hasOverdueFees, requiresCard } from "@/db/queries/fees";

describe("canAcceptOrders", () => {
  beforeEach(() => vi.resetAllMocks());

  it("true за нов магазин без такси и без изискана карта", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(false);
    vi.mocked(requiresCard).mockResolvedValue(false);
    expect(await canAcceptOrders("shop-1")).toBe(true);
  });

  it("false при просрочена фактура", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(true);
    vi.mocked(requiresCard).mockResolvedValue(false);
    expect(await canAcceptOrders("shop-1")).toBe(false);
  });

  it("false когато се изисква карта (след първа продажба)", async () => {
    vi.mocked(hasOverdueFees).mockResolvedValue(false);
    vi.mocked(requiresCard).mockResolvedValue(true);
    expect(await canAcceptOrders("shop-1")).toBe(false);
  });
});

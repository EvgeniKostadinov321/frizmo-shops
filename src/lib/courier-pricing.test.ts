import { describe, expect, it, vi } from "vitest";
import { resolveCourierShippingCents } from "./courier-pricing";

describe("resolveCourierShippingCents", () => {
  it("над прага за безплатна → безплатна, НЕ пита live", async () => {
    const live = vi.fn();
    const r = await resolveCourierShippingCents({
      subtotalCents: 6000,
      freeOverCents: 5000,
      fallbackPriceCents: 500,
      live,
    });
    expect(r).toEqual({ cents: 0, free: true, source: "free" });
    expect(live).not.toHaveBeenCalled();
  });

  it("точно на прага → безплатна (>=)", async () => {
    const r = await resolveCourierShippingCents({
      subtotalCents: 5000,
      freeOverCents: 5000,
      fallbackPriceCents: 500,
      live: async () => ({ amountCents: 344 }),
    });
    expect(r.free).toBe(true);
    expect(r.cents).toBe(0);
  });

  it("под прага + live успех → live цена", async () => {
    const r = await resolveCourierShippingCents({
      subtotalCents: 3000,
      freeOverCents: 5000,
      fallbackPriceCents: 500,
      live: async () => ({ amountCents: 344 }),
    });
    expect(r).toEqual({ cents: 344, free: false, source: "live" });
  });

  it("без праг + live успех → live цена", async () => {
    const r = await resolveCourierShippingCents({
      subtotalCents: 3000,
      freeOverCents: null,
      fallbackPriceCents: 500,
      live: async () => ({ amountCents: 288 }),
    });
    expect(r).toEqual({ cents: 288, free: false, source: "live" });
  });

  it("live връща null → резервна цена", async () => {
    const r = await resolveCourierShippingCents({
      subtotalCents: 3000,
      freeOverCents: null,
      fallbackPriceCents: 500,
      live: async () => null,
    });
    expect(r).toEqual({ cents: 500, free: false, source: "fallback" });
  });
});

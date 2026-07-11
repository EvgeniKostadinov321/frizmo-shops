import { describe, expect, it } from "vitest";
import { isNewProduct } from "./product-badges";

const now = Date.UTC(2026, 6, 11); // фиксиран „сега" за детерминизъм

describe("isNewProduct", () => {
  it("създаден днес → нов", () => expect(isNewProduct(new Date(now), now)).toBe(true));
  it("създаден преди 13 дни → нов", () =>
    expect(isNewProduct(new Date(now - 13 * 86400000), now)).toBe(true));
  it("създаден преди 15 дни → не е нов", () =>
    expect(isNewProduct(new Date(now - 15 * 86400000), now)).toBe(false));
  it("точна граница 14 дни → нов (включително)", () =>
    expect(isNewProduct(new Date(now - 14 * 86400000), now)).toBe(true));
  it("персонализиран праг 7 дни", () =>
    expect(isNewProduct(new Date(now - 10 * 86400000), now, 7)).toBe(false));
});

import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("транслитерира кирилица", () => expect(slugify("Ферма Марица")).toBe("ferma-maritsa"));
  it("справя се с щ/ж/ч/ш/ю/я", () => expect(slugify("Ябълки и жито Шумен")).toBe("yabalki-i-zhito-shumen"));
  it("маха специални знаци", () => expect(slugify("Мода & Стил 2026!")).toBe("moda-stil-2026"));
  it("маха водещи/крайни тирета", () => expect(slugify("--тест--")).toBe("test"));
  it("реже до 60 знака", () => expect(slugify("а".repeat(100)).length).toBeLessThanOrEqual(60));
  it("празен вход дава празен изход", () => expect(slugify("!!!")).toBe(""));
});

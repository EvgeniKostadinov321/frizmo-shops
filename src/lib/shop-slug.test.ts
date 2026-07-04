import { describe, expect, it } from "vitest";
import {
  isUniqueViolation,
  nextSlugCandidate,
  RESERVED_SLUGS,
  shopSlugBase,
} from "./shop-slug";

describe("nextSlugCandidate", () => {
  it("първи опит връща базата", () => expect(nextSlugCandidate("ferma", 0)).toBe("ferma"));
  it("втори опит добавя -2", () => expect(nextSlugCandidate("ferma", 1)).toBe("ferma-2"));
  it("трети опит добавя -3", () => expect(nextSlugCandidate("ferma", 2)).toBe("ferma-3"));
});

describe("shopSlugBase", () => {
  it("транслитерира кирилица", () => expect(shopSlugBase("Ателие Ръчичка")).toBe("atelie-rachichka"));
  it("резервиран slug получава -shop суфикс", () => expect(shopSlugBase("admin")).toBe("admin-shop"));
  it("празно/непреводимо име пада на 'magazin'", () => expect(shopSlugBase("!!!")).toBe("magazin"));
});

describe("isUniqueViolation", () => {
  it("разпознава Postgres 23505", () => expect(isUniqueViolation({ code: "23505" })).toBe(true));
  it("друг код не е нарушение", () => expect(isUniqueViolation({ code: "23503" })).toBe(false));
  it("не гърми при null/невалиден вход", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });
});

describe("RESERVED_SLUGS", () => {
  it("пази системните пътища", () => {
    for (const slug of ["admin", "dashboard", "auth", "s", "api", "blog"]) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true);
    }
  });
});

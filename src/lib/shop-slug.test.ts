import { describe, expect, it } from "vitest";
import { nextSlugCandidate, RESERVED_SLUGS } from "./shop-slug";

describe("nextSlugCandidate", () => {
  it("първи опит връща базата", () => expect(nextSlugCandidate("ferma", 0)).toBe("ferma"));
  it("втори опит добавя -2", () => expect(nextSlugCandidate("ferma", 1)).toBe("ferma-2"));
  it("трети опит добавя -3", () => expect(nextSlugCandidate("ferma", 2)).toBe("ferma-3"));
});

describe("RESERVED_SLUGS", () => {
  it("пази системните пътища", () => {
    for (const slug of ["admin", "dashboard", "auth", "s", "api", "blog"]) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { count, NOUNS, noun } from "./plural";

describe("noun", () => {
  it("единствено при n===1", () => expect(noun(1, NOUNS.product)).toBe("продукт"));
  it("множествено при n!==1", () => {
    expect(noun(3, NOUNS.product)).toBe("продукта");
    expect(noun(0, NOUNS.product)).toBe("продукта");
  });
});

describe("count", () => {
  it("число + дума", () => {
    expect(count(1, NOUNS.product)).toBe("1 продукт");
    expect(count(5, NOUNS.product)).toBe("5 продукта");
  });
  it("продадени: число + дума", () => {
    expect(count(1, NOUNS.sold)).toBe("1 продаден");
    expect(count(47, NOUNS.sold)).toBe("47 продадени");
  });
});

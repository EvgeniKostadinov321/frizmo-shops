import { describe, expect, it } from "vitest";
import { isDirty } from "./is-dirty";

describe("isDirty", () => {
  it("еднакви стойности → false", () => {
    expect(isDirty({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(false);
  });
  it("различни стойности → true", () => {
    expect(isDirty({ a: 1 }, { a: 2 })).toBe(true);
  });
  it("вложени обекти се сравняват по стойност", () => {
    expect(isDirty({ x: { y: [1, 2] } }, { x: { y: [1, 2] } })).toBe(false);
    expect(isDirty({ x: { y: [1, 2] } }, { x: { y: [1, 3] } })).toBe(true);
  });
});

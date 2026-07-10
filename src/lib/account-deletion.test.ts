import { describe, expect, it } from "vitest";
import { confirmNameMatches } from "./account-deletion";

describe("confirmNameMatches", () => {
  it("точно съвпадение → true", () =>
    expect(confirmNameMatches("Моят магазин", "Моят магазин")).toBe(true));
  it("trim от двете страни → true", () =>
    expect(confirmNameMatches("  Моят магазин  ", "Моят магазин")).toBe(true));
  it("различно име → false", () =>
    expect(confirmNameMatches("Друг", "Моят магазин")).toBe(false));
  it("различен регистър → false (защитна бариера)", () =>
    expect(confirmNameMatches("моят магазин", "Моят магазин")).toBe(false));
  it("само празни символи → false", () =>
    expect(confirmNameMatches("   ", "Моят магазин")).toBe(false));
  it("частично съвпадение → false", () =>
    expect(confirmNameMatches("Моят", "Моят магазин")).toBe(false));
});

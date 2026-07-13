import { describe, expect, it } from "vitest";
import { confirmDeleteWord, confirmNameMatches } from "./account-deletion";

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

describe("confirmDeleteWord", () => {
  it("приема ИЗТРИЙ (главни)", () => expect(confirmDeleteWord("ИЗТРИЙ")).toBe(true));
  it("приема с интервали и малки букви", () => expect(confirmDeleteWord("  изтрий ")).toBe(true));
  it("отхвърля празно", () => expect(confirmDeleteWord("")).toBe(false));
  it("отхвърля друга дума", () => expect(confirmDeleteWord("изтриване")).toBe(false));
});

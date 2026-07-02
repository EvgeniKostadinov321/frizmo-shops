import { describe, expect, it } from "vitest";
import { formatPrice, toCents } from "./money";

// Intl слага non-breaking space — нормализираме за четими assertions
const norm = (s: string) => s.replace(/\u00A0/g, " ");

describe("toCents", () => {
  it("парсва цяло число", () => expect(toCents("12")).toBe(1200));
  it("парсва с десетична запетая (БГ вход)", () => expect(toCents("12,50")).toBe(1250));
  it("парсва с десетична точка", () => expect(toCents("12.50")).toBe(1250));
  it("отхвърля отрицателни", () => expect(toCents("-5")).toBeNull());
  it("отхвърля повече от 2 десетични знака", () => expect(toCents("1.999")).toBeNull());
  it("отхвърля текст", () => expect(toCents("abc")).toBeNull());
  it("отхвърля празен низ", () => expect(toCents("")).toBeNull());
  it("няма float грешки", () => expect(toCents("0,29")).toBe(29));
});

describe("formatPrice", () => {
  it("форматира в EUR по бг локал", () => expect(norm(formatPrice(1250))).toBe("12,50 €"));
  it("форматира нула", () => expect(norm(formatPrice(0))).toBe("0,00 €"));
  it("форматира хиляди", () => expect(norm(formatPrice(123456))).toBe("1234,56 €"));
});

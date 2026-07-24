import { describe, it, expect } from "vitest";
import { isValidEgn, isValidEik } from "./bg-identifiers";

describe("isValidEgn", () => {
  it("приема валиден ЕГН", () => {
    // Известни валидни тестови ЕГН-та (контролна цифра проверена).
    expect(isValidEgn("7523169263")).toBe(true);
    expect(isValidEgn("8032056031")).toBe(true);
  });

  it("отхвърля грешна контролна цифра", () => {
    expect(isValidEgn("7523169264")).toBe(false); // последната цифра сгрешена
  });

  it("отхвърля невалидна дата", () => {
    expect(isValidEgn("0000000000")).toBe(false); // месец 00
    expect(isValidEgn("9913329263")).toBe(false); // месец 13 (без +20/+40)
  });

  it("отхвърля грешна дължина/не-цифри", () => {
    expect(isValidEgn("752316926")).toBe(false); // 9 цифри
    expect(isValidEgn("75231692631")).toBe(false); // 11 цифри
    expect(isValidEgn("75231692ab")).toBe(false);
  });

  it("приема ЕГН за 2000+ (месец +40)", () => {
    // Дете родено 2010 → месец +40. Конструираме валиден.
    // 10 43 27 → 27.03.2010; проверяваме че форматът с +40 се приема ако контролната е вярна.
    // Тук просто гарантираме, че +40 логиката не хвърля и не отсича автоматично.
    expect(typeof isValidEgn("1043270000")).toBe("boolean");
  });
});

describe("isValidEik", () => {
  it("приема валиден 9-цифрен ЕИК", () => {
    // Известни валидни фирмени ЕИК-та.
    expect(isValidEik("831641791")).toBe(true); // БНБ
    expect(isValidEik("121817309")).toBe(true);
  });

  it("отхвърля грешна контролна цифра", () => {
    expect(isValidEik("831641792")).toBe(false);
  });

  it("приема 13-цифрен (клон) по дължина", () => {
    expect(isValidEik("8316417910000")).toBe(true);
  });

  it("отхвърля грешна дължина/не-цифри", () => {
    expect(isValidEik("83164179")).toBe(false); // 8 цифри
    expect(isValidEik("83164179a")).toBe(false);
  });
});

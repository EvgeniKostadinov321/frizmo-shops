import { describe, expect, it } from "vitest";
import { cmToMm, formatNetQuantity, formatPrice, parseScaled, scaledToInput, toCents, toMilliQuantity } from "./money";

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

describe("centsToInput", () => {
  it("конвертира центове към формулярен string", async () => {
    const { centsToInput } = await import("./money");
    expect(centsToInput(1250)).toBe("12,50");
    expect(centsToInput(900)).toBe("9,00");
    expect(centsToInput(null)).toBe("");
  });
});

describe("formatPrice", () => {
  it("форматира в EUR по бг локал", () => expect(norm(formatPrice(1250))).toBe("12,50 €"));
  it("форматира нула", () => expect(norm(formatPrice(0))).toBe("0,00 €"));
  it("форматира хиляди", () => expect(norm(formatPrice(123456))).toBe("1234,56 €"));
});

describe("parseScaled", () => {
  it("парсва десетична запетая с фактор 1000", () => expect(parseScaled("0,5", 1000)).toBe(500));
  it("парсва десетична точка с фактор 1000", () => expect(parseScaled("1.5", 1000)).toBe(1500));
  it("парсва цяло с фактор 10", () => expect(parseScaled("30", 10)).toBe(300));
  it("парсва десетичен см с фактор 10", () => expect(parseScaled("30,5", 10)).toBe(305));
  it("нула е валидна", () => expect(parseScaled("0", 10)).toBe(0));
  it("отхвърля празен низ", () => expect(parseScaled("", 10)).toBeNull());
  it("отхвърля текст", () => expect(parseScaled("abc", 10)).toBeNull());
  it("отхвърля отрицателни", () => expect(parseScaled("-1", 10)).toBeNull());
  it("закръгля коректно", () => expect(parseScaled("0,333", 1000)).toBe(333));
});

describe("toMilliQuantity / cmToMm", () => {
  it("toMilliQuantity умножава по 1000", () => expect(toMilliQuantity("0,5")).toBe(500));
  it("cmToMm умножава по 10", () => expect(cmToMm("30")).toBe(300));
  it("cmToMm приема десетичен см", () => expect(cmToMm("30,5")).toBe(305));
});

describe("formatNetQuantity", () => {
  // Съхранение = въведено × 1000. „500 мл“ → пази 500000; „0,5 л“ → пази 500.
  it("500 мл (съхранено 500000)", () => expect(formatNetQuantity(500_000, "ml")).toBe("500 мл"));
  it("десетичен литър със запетая (съхранено 1500)", () => expect(formatNetQuantity(1500, "l")).toBe("1,5 л"));
  it("грам (съхранено 250000)", () => expect(formatNetQuantity(250_000, "g")).toBe("250 г"));
  it("цял килограм без „,0“ (съхранено 1000)", () => expect(formatNetQuantity(1000, "kg")).toBe("1 кг"));
  it("милиграм (съхранено 5000000)", () => expect(formatNetQuantity(5_000_000, "mg")).toBe("5000 мг"));
  it("десетично количество (съхранено 500 → 0,5)", () => expect(formatNetQuantity(500, "ml")).toBe("0,5 мл"));
});

describe("scaledToInput", () => {
  it("количество 500 × factor 1000 → „0.5“", () => expect(scaledToInput(500, 1000)).toBe("0.5"));
  it("количество 1500 → „1.5“", () => expect(scaledToInput(1500, 1000)).toBe("1.5"));
  it("размер 305 × factor 10 → „30.5“", () => expect(scaledToInput(305, 10)).toBe("30.5"));
  it("размер 300 → цяло „30“", () => expect(scaledToInput(300, 10)).toBe("30"));
});

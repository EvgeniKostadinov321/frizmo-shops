import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, toCsv } from "./csv";

describe("detectDelimiter", () => {
  it("познава запетая и точка и запетая", () => {
    expect(detectDelimiter("name,price,stock")).toBe(",");
    expect(detectDelimiter("name;price;stock")).toBe(";");
  });

  it("игнорира разделители в кавички", () => {
    expect(detectDelimiter('"а;б;в",цена')).toBe(",");
  });
});

describe("parseCsv", () => {
  it("парсва прост CSV", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("парсва кавички, escaped кавички и нови редове в стойности", () => {
    expect(parseCsv('име,"описание с , и ""кавички""","много\nредово"')).toEqual([
      ["име", 'описание с , и "кавички"', "много\nредово"],
    ]);
  });

  it("парсва ; разделител (Excel BG) и маха BOM", () => {
    expect(parseCsv("\uFEFFиме;цена\nТорта;12,50")).toEqual([
      ["име", "цена"],
      ["Торта", "12,50"],
    ]);
  });

  it("пропуска празни редове", () => {
    expect(parseCsv("a,b\n\n1,2\n   ,\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("toCsv", () => {
  it("escape-ва стойности и е обратим през parseCsv", () => {
    const rows = [
      ["име", "описание"],
      ['с "кавички"', "със , запетая"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

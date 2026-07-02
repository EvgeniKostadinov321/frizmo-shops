import { describe, expect, it } from "vitest";
import {
  emptyVariant,
  generateCombinations,
  mergeVariants,
  variantKey,
  type OptionAxis,
} from "./variants";

const axes: OptionAxis[] = [
  { name: "Размер", values: ["S", "M"] },
  { name: "Цвят", values: ["Син", "Червен", "Зелен"] },
];

describe("generateCombinations", () => {
  it("прави декартово произведение (2×3=6)", () => {
    const combos = generateCombinations(axes);
    expect(combos).toHaveLength(6);
    expect(combos[0]).toEqual({ Размер: "S", Цвят: "Син" });
    expect(combos[5]).toEqual({ Размер: "M", Цвят: "Зелен" });
  });

  it("празни оси дават празен резултат", () => {
    expect(generateCombinations([])).toEqual([]);
    expect(generateCombinations([{ name: "", values: ["X"] }])).toEqual([]);
    expect(generateCombinations([{ name: "Размер", values: [] }])).toEqual([]);
  });

  it("една ос дава по една комбинация на стойност", () => {
    expect(generateCombinations([{ name: "Обем", values: ["1л", "2л"] }])).toEqual([
      { Обем: "1л" },
      { Обем: "2л" },
    ]);
  });
});

describe("variantKey", () => {
  it("стабилен е при разместен ред на ключовете", () => {
    expect(variantKey({ a: "1", b: "2" })).toBe(variantKey({ b: "2", a: "1" }));
  });
});

describe("mergeVariants", () => {
  it("пази въведените стойности и добавя новите комбинации празни", () => {
    const existing = [{ ...emptyVariant({ Размер: "S" }), price: "10", stock: "3" }];
    const merged = mergeVariants([{ Размер: "S" }, { Размер: "M" }], existing);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ price: "10", stock: "3" });
    expect(merged[1]).toMatchObject({ options: { Размер: "M" }, price: "" });
  });

  it("маха комбинации, които вече не съществуват", () => {
    const existing = [emptyVariant({ Размер: "S" }), emptyVariant({ Размер: "M" })];
    const merged = mergeVariants([{ Размер: "M" }], existing);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.options).toEqual({ Размер: "M" });
  });
});

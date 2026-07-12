import { describe, expect, it } from "vitest";
import {
  categoryDepth,
  collectDescendantIds,
  flattenCategoryOptions,
  MAX_CATEGORY_DEPTH,
} from "./category-tree";

describe("flattenCategoryOptions", () => {
  const tree = [
    {
      id: "a",
      name: "Дрехи",
      children: [
        {
          id: "b",
          name: "Дамски",
          children: [{ id: "c", name: "Рокли", children: [] }],
        },
      ],
    },
  ];
  it("сплесква 3 нива с „→“ път", () => {
    expect(flattenCategoryOptions(tree)).toEqual([
      { value: "a", label: "Дрехи" },
      { value: "b", label: "Дрехи → Дамски" },
      { value: "c", label: "Дрехи → Дамски → Рокли" },
    ]);
  });
  it("празно дърво → празни опции", () => {
    expect(flattenCategoryOptions([])).toEqual([]);
  });
});

describe("categoryDepth guard", () => {
  it("корен (ниво 1) → детето е ниво 2 → ок", () => {
    expect(categoryDepth(1)).toBe(2);
    expect(categoryDepth(1)).toBeLessThanOrEqual(MAX_CATEGORY_DEPTH);
  });
  it("родител на ниво 2 → детето е ниво 3 → ок", () => {
    expect(categoryDepth(2)).toBe(3);
    expect(categoryDepth(2)).toBeLessThanOrEqual(MAX_CATEGORY_DEPTH);
  });
  it("родител на ниво 3 → детето би било 4 → над лимита", () => {
    expect(categoryDepth(3)).toBe(4);
    expect(categoryDepth(3)).toBeGreaterThan(MAX_CATEGORY_DEPTH);
  });
});

describe("collectDescendantIds", () => {
  const cats = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
    { id: "d", parentId: null },
  ];
  it("корен → себе си + всички наследници", () => {
    expect(collectDescendantIds(cats, "a").sort()).toEqual(["a", "b", "c"]);
  });
  it("среден възел → себе си + наследници", () => {
    expect(collectDescendantIds(cats, "b").sort()).toEqual(["b", "c"]);
  });
  it("лист → само себе си", () => {
    expect(collectDescendantIds(cats, "c")).toEqual(["c"]);
  });
  it("несвързан възел → само себе си", () => {
    expect(collectDescendantIds(cats, "d")).toEqual(["d"]);
  });
});

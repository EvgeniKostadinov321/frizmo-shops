import { describe, expect, it } from "vitest";
import { sizeGuideSchema } from "./size-guide";

describe("sizeGuideSchema", () => {
  it("приема валидна таблица", () => {
    const r = sizeGuideSchema.safeParse({
      name: "Дамски",
      columns: ["Размер", "Талия"],
      rows: [
        ["S", "60"],
        ["M", "64"],
      ],
    });
    expect(r.success).toBe(true);
  });
  it("отхвърля ред с грешен брой клетки", () => {
    const r = sizeGuideSchema.safeParse({
      name: "Дамски",
      columns: ["Размер", "Талия"],
      rows: [["S"]],
    });
    expect(r.success).toBe(false);
  });
  it("отхвърля 0 колони", () => {
    const r = sizeGuideSchema.safeParse({ name: "Дамски", columns: [], rows: [] });
    expect(r.success).toBe(false);
  });
  it("отхвърля късо име", () => {
    const r = sizeGuideSchema.safeParse({ name: "A", columns: ["Размер"], rows: [] });
    expect(r.success).toBe(false);
  });
});

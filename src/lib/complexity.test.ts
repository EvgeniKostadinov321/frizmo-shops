import { describe, expect, it } from "vitest";
import { MODE_LEVEL, MODE_META, isVisible, type ComplexityMode } from "./complexity";

describe("complexity", () => {
  it("нивата са наредени hobby < business < full", () => {
    expect(MODE_LEVEL.hobby).toBeLessThan(MODE_LEVEL.business);
    expect(MODE_LEVEL.business).toBeLessThan(MODE_LEVEL.full);
  });

  it("hobby вижда само minMode 0", () => {
    expect(isVisible(0, "hobby")).toBe(true);
    expect(isVisible(1, "hobby")).toBe(false);
    expect(isVisible(2, "hobby")).toBe(false);
  });

  it("business вижда minMode 0 и 1, не 2", () => {
    expect(isVisible(0, "business")).toBe(true);
    expect(isVisible(1, "business")).toBe(true);
    expect(isVisible(2, "business")).toBe(false);
  });

  it("full вижда всичко", () => {
    expect(isVisible(0, "full")).toBe(true);
    expect(isVisible(1, "full")).toBe(true);
    expect(isVisible(2, "full")).toBe(true);
  });

  it("MODE_META покрива и трите режима в ред hobby→business→full", () => {
    expect(MODE_META.map((m) => m.value)).toEqual<ComplexityMode[]>([
      "hobby",
      "business",
      "full",
    ]);
    for (const m of MODE_META) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});

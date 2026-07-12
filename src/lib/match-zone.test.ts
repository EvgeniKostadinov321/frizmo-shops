import { describe, expect, it } from "vitest";
import { matchZone, type ZoneLike } from "./match-zone";

const z = (name: string, cities: string, isFallback = false, sortOrder = 0): ZoneLike =>
  ({ name, cities, isFallback, sortOrder }) as ZoneLike;

describe("matchZone", () => {
  const zones = [
    z("София", "София", false, 1),
    z("Големи градове", "Пловдив, Варна, Бургас", false, 2),
    z("Останала страна", "", true, 3),
  ];

  it("точен мач по град", () => {
    expect(matchZone("София", zones)?.name).toBe("София");
  });
  it("мач в списък със запетаи", () => {
    expect(matchZone("Варна", zones)?.name).toBe("Големи градове");
  });
  it("case-insensitive + trim", () => {
    expect(matchZone("  пловдив ", zones)?.name).toBe("Големи градове");
  });
  it("маха префикс „гр.“", () => {
    expect(matchZone("гр. София", zones)?.name).toBe("София");
  });
  it("непознат град → fallback зоната", () => {
    expect(matchZone("Козлодуй", zones)?.name).toBe("Останала страна");
  });
  it("непознат град без fallback → null", () => {
    const noFallback = [z("София", "София", false, 1)];
    expect(matchZone("Козлодуй", noFallback)).toBeNull();
  });
  it("празен град → fallback (ако има)", () => {
    expect(matchZone("", zones)?.name).toBe("Останала страна");
  });
  it("първата зона по sortOrder печели при дублиран град", () => {
    const dup = [z("Б", "София", false, 2), z("А", "София", false, 1)];
    expect(matchZone("София", dup)?.name).toBe("А");
  });
});

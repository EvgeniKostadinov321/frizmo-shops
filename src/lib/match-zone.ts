export interface ZoneLike {
  name: string;
  cities: string;
  isFallback: boolean;
  sortOrder: number;
}

/** Нормализира град: trim, lowercase, маха префикси „гр./град/с./село“ и точки. */
function normalizeCity(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(гр|град|с|село)\.?\s+/u, "")
    .trim();
}

/**
 * Намира зоната за даден град: първо точен мач в списъка `cities` (първата по
 * sortOrder печели), иначе зоната с `isFallback`, иначе null.
 */
export function matchZone<T extends ZoneLike>(city: string, zones: T[]): T | null {
  const target = normalizeCity(city);
  const sorted = [...zones].sort((a, b) => a.sortOrder - b.sortOrder);

  if (target) {
    for (const zone of sorted) {
      const cityList = zone.cities
        .split(",")
        .map((c) => normalizeCity(c))
        .filter(Boolean);
      if (cityList.includes(target)) return zone;
    }
  }
  return sorted.find((z) => z.isFallback) ?? null;
}

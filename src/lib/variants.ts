export interface OptionAxis {
  name: string;
  values: string[];
}

/** Формата държи вариантите като string полета (както Zod схемата); сървърът конвертира с toCents. */
export interface VariantDraft {
  options: Record<string, string>;
  price: string;
  stock: string;
  sku: string;
  imagePaths: string[];
}

export function emptyVariant(options: Record<string, string>): VariantDraft {
  return { options, price: "", stock: "", sku: "", imagePaths: [] };
}

/** Декартово произведение на осите → всички комбинации. */
export function generateCombinations(axes: OptionAxis[]): Record<string, string>[] {
  const valid = axes.filter((a) => a.name.trim() && a.values.length > 0);
  if (valid.length === 0) return [];
  return valid.reduce<Record<string, string>[]>(
    (acc, axis) => acc.flatMap((combo) => axis.values.map((v) => ({ ...combo, [axis.name]: v }))),
    [{}],
  );
}

export function variantKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}:${options[k]}`)
    .join("|");
}

/** Слива нови комбинации със съществуващи чернови — пази въведените стойности. */
export function mergeVariants(
  combos: Record<string, string>[],
  existing: VariantDraft[],
): VariantDraft[] {
  const byKey = new Map(existing.map((v) => [variantKey(v.options), v]));
  return combos.map((options) => byKey.get(variantKey(options)) ?? emptyVariant(options));
}

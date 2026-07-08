/**
 * Числово съгласуване на български (виж docs/bulgarian-lang-guide.md).
 * 1 → единствено число; всяко друго (вкл. 0) → множествено/бройна форма.
 *
 * Бройна форма за мъжки род неодушевени е на -а/-я (3 продукт**а**), затова
 * подаваме и двете форми изрично — няма надеждно автоматично правило.
 */

export interface PluralForms {
  /** Единствено число (n === 1). */
  one: string;
  /** Множествено/бройна форма (n !== 1). */
  many: string;
}

/** Речник с формите на често срещаните думи в проекта. */
export const NOUNS = {
  product: { one: "продукт", many: "продукта" },
  order: { one: "поръчка", many: "поръчки" },
  promo: { one: "промоция", many: "промоции" },
  review: { one: "ревю", many: "ревюта" },
  subscriber: { one: "абонат", many: "абонати" },
  recipient: { one: "получател", many: "получатели" },
  category: { one: "категория", many: "категории" },
  result: { one: "резултат", many: "резултата" },
  day: { one: "ден", many: "дни" },
  image: { one: "снимка", many: "снимки" },
} as const;

/** Само думата в правилната форма: `noun(1, NOUNS.promo)` → "промоция". */
export function noun(n: number, forms: PluralForms): string {
  return n === 1 ? forms.one : forms.many;
}

/** Число + дума: `count(3, NOUNS.product)` → "3 продукта". */
export function count(n: number, forms: PluralForms): string {
  return `${n} ${noun(n, forms)}`;
}

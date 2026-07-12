/**
 * Режим на сложност — прогресивно разкриване на dashboard функциите. Чисто
 * презентационен: определя КОИ секции/полета се показват, никога не трие/спира
 * данни. Разделен от плановата система (безплатен за всеки магазин).
 */

export type ComplexityMode = "hobby" | "business" | "full";

/** Числово ниво — елемент с minMode се показва при currentMode ≥ minMode. */
export const MODE_LEVEL: Record<ComplexityMode, number> = {
  hobby: 0,
  business: 1,
  full: 2,
};

export interface ModeMeta {
  value: ComplexityMode;
  label: string;
  description: string;
}

/** Метаданни за дропдауна/onboarding — ред hobby → business → full. */
export const MODE_META: ModeMeta[] = [
  { value: "hobby", label: "Хоби", description: "Само основното — продукти, поръчки, магазин." },
  {
    value: "business",
    label: "Малък бизнес",
    description: "Основното + категории, промо кодове, ревюта, аналитика.",
  },
  {
    value: "full",
    label: "Пълна настройка",
    description: "Всички функции — реферали, product feed, SEO, варианти и още.",
  },
];

/** Видим ли е елемент с даден minMode при текущия режим. */
export function isVisible(itemMinMode: number, currentMode: ComplexityMode): boolean {
  return MODE_LEVEL[currentMode] >= itemMinMode;
}

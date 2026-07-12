/**
 * Дали `current` се различава от `baseline` — по стойност (JSON сравнение).
 * За форми с прости полета: подай baseline, деривиран от props-ите (запазените
 * данни), и current = живия state. След успешен запис + `router.refresh()`
 * props-ите се обновяват → baseline настига current → формата пак е „чиста".
 *
 * Не е hook (няма state); чиста функция за яснота и тестваемост.
 */
export function isDirty(current: unknown, baseline: unknown): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

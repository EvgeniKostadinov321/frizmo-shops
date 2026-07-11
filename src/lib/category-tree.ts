/** Максимална дълбочина на категорийната йерархия (категория → под → под-под). */
export const MAX_CATEGORY_DEPTH = 3;

/** Нивото на дете при даден родител: детето е с 1 под родителя. */
export function categoryDepth(parentLevel: number): number {
  return parentLevel + 1;
}

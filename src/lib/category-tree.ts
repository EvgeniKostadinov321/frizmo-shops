/** Максимална дълбочина на категорийната йерархия (категория → под → под-под). */
export const MAX_CATEGORY_DEPTH = 3;

/** Нивото на дете при даден родител: детето е с 1 под родителя. */
export function categoryDepth(parentLevel: number): number {
  return parentLevel + 1;
}

/**
 * Д2: id-тата на категория + всичките ѝ наследници (поддърво). За филтъра по
 * категория, който включва подкатегориите. Пази се от цикли (visited).
 */
export function collectDescendantIds(
  cats: { id: string; parentId: string | null }[],
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const c of cats) {
    if (c.parentId) {
      const arr = childrenOf.get(c.parentId) ?? [];
      arr.push(c.id);
      childrenOf.set(c.parentId, arr);
    }
  }
  const result: string[] = [];
  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child);
  }
  return result;
}

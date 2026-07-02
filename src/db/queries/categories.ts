import { asc, count, eq } from "drizzle-orm";
import { categories, db, products, type Category } from "@/db";

export interface CategoryWithCount extends Category {
  productCount: number;
}

export interface CategoryNode extends CategoryWithCount {
  children: CategoryWithCount[];
}

export async function getCategoriesTree(shopId: string): Promise<CategoryNode[]> {
  const rows = await db
    .select({
      id: categories.id,
      shopId: categories.shopId,
      parentId: categories.parentId,
      name: categories.name,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.shopId, shopId))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));

  const roots: CategoryNode[] = rows
    .filter((r) => r.parentId === null)
    .map((r) => ({ ...r, children: [] }));
  const byId = new Map(roots.map((r) => [r.id, r]));

  for (const row of rows) {
    if (row.parentId === null) continue;
    const parent = byId.get(row.parentId);
    /* Подкатегория с липсващ родител (изтрит) се показва като коренна. */
    if (parent) parent.children.push(row);
    else roots.push({ ...row, children: [] });
  }

  return roots;
}

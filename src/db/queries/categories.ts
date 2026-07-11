import { asc, count, eq } from "drizzle-orm";
import { categories, db, products, type Category } from "@/db";

export interface CategoryWithCount extends Category {
  productCount: number;
}

export interface CategoryLeaf extends CategoryWithCount {
  children: CategoryWithCount[];
}

export interface CategoryNode extends CategoryWithCount {
  children: CategoryLeaf[];
}

export async function countCategories(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(categories)
    .where(eq(categories.shopId, shopId));
  return row?.value ?? 0;
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

  /* Дърво до 3 нива. Строим Map за всеки ред (с празни children), после закачаме
     всяко дете към родителя му. Ред с изтрит/липсващ родител се качва като корен
     (консистентно със старото поведение). Ниво 4+ (не би трябвало — гардът го спира)
     се третира като лист под родителя си. */
  type AnyNode = CategoryWithCount & { children: AnyNode[] };
  const nodeById = new Map<string, AnyNode>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: AnyNode[] = [];

  for (const row of rows) {
    const node = nodeById.get(row.id)!;
    const parent = row.parentId ? nodeById.get(row.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots as CategoryNode[];
}

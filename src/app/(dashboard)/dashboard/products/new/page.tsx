import { ProductForm } from "@/components/dashboard/product-form";
import { getCategoriesTree } from "@/db/queries/categories";
import { getSizeGuides } from "@/db/queries/size-guides";
import { requireShop } from "@/lib/auth";
import { flattenCategoryOptions } from "@/lib/category-tree";

export const metadata = { title: "Нов продукт — Frizmo Shops" };

export default async function NewProductPage() {
  const { shop } = await requireShop();
  const [tree, guides] = await Promise.all([
    getCategoriesTree(shop.id),
    getSizeGuides(shop.id),
  ]);
  const categoryOptions = flattenCategoryOptions(tree);
  const sizeGuideOptions = guides.map((g) => ({ value: g.id, label: g.name }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Нов продукт</h1>
      <ProductForm categories={categoryOptions} sizeGuides={sizeGuideOptions} />
    </div>
  );
}

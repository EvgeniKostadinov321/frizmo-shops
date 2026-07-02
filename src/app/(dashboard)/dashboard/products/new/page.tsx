import { ProductForm } from "@/components/dashboard/product-form";
import { getCategoriesTree } from "@/db/queries/categories";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Нов продукт — Frizmo Shops" };

export default async function NewProductPage() {
  const { shop } = await requireShop();
  const tree = await getCategoriesTree(shop.id);
  const categoryOptions = tree.flatMap((root) => [
    { value: root.id, label: root.name },
    ...root.children.map((c) => ({ value: c.id, label: `${root.name} → ${c.name}` })),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Нов продукт</h1>
      <ProductForm categories={categoryOptions} />
    </div>
  );
}

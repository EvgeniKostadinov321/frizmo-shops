import { CategoriesManager } from "@/components/dashboard/categories-manager";
import { getCategoriesTree } from "@/db/queries/categories";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Категории — Frizmo Shops" };

export default async function CategoriesPage() {
  const { shop } = await requireShop();
  const tree = await getCategoriesTree(shop.id);
  return <CategoriesManager tree={tree} />;
}

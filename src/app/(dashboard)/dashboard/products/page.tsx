import { ProductImportExport } from "@/components/dashboard/product-import-export";
import { ProductList } from "@/components/dashboard/product-list";
import { LinkButton } from "@/components/ui";
import { getCategoriesTree } from "@/db/queries/categories";
import { getProducts } from "@/db/queries/products";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Продукти — Frizmo Shops" };

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    stock?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { shop } = await requireShop();
  const params = await searchParams;

  const [result, tree] = await Promise.all([
    getProducts(shop.id, {
      search: params.search,
      categoryId: params.category,
      status: params.status === "active" || params.status === "inactive" ? params.status : undefined,
      stock: params.stock === "low" ? "low" : undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    getCategoriesTree(shop.id),
  ]);

  const categoryOptions = tree.flatMap((root) => [
    { value: root.id, label: root.name },
    ...root.children.map((c) => ({ value: c.id, label: `${root.name} → ${c.name}` })),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* Заглавие + „Нов продукт" на един ред (и на мобилно, за да спести място);
          CSV бутоните са само десктоп тук — на мобилно са във filter drawer-а. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-900">Продукти</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ProductImportExport />
          </div>
          <LinkButton href="/dashboard/products/new">Нов продукт</LinkButton>
        </div>
      </div>
      <ProductList
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        categories={categoryOptions}
        csvTools={<ProductImportExport stacked />}
      />
    </div>
  );
}

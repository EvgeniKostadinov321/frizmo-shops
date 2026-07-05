import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getActiveProducts,
  getPublicCategories,
  getPublicShop,
} from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ search?: string; category?: string; page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { title: `Продукти — ${result.shop.name}` };
}

export default async function StorefrontProductsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;
  const base = `/s/${shop.slug}`;

  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;
  const [{ items, hasMore }, categories] = await Promise.all([
    getActiveProducts(shop.id, { search: sp.search, categoryId: sp.category, page }),
    getPublicCategories(shop.id),
  ]);

  const roots = categories.filter((c) => c.parentId === null);
  const children = sp.category
    ? categories.filter((c) => c.parentId === sp.category)
    : [];
  const activeCategory = categories.find((c) => c.id === sp.category);

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { search: sp.search, category: sp.category, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${base}/products?${qs}` : `${base}/products`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1
        className="mb-6 text-3xl text-(--sf-text)"
      >
        {activeCategory ? activeCategory.name : "Всички продукти"}
      </h1>

      <div className="mb-6 flex flex-col gap-4">
        <form action={`${base}/products`} className="flex max-w-md gap-2">
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          <input
            type="search"
            name="search"
            defaultValue={sp.search}
            placeholder="Търси продукт..."
            aria-label="Търсене на продукти"
            className="h-11 flex-1 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3 text-(--sf-text) placeholder:text-(--sf-muted)"
          />
          <button
            type="submit"
            className="sf-cta h-11 rounded-(--sf-radius) bg-(--sf-primary) px-4 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
          >
            Търси
          </button>
        </form>

        {(roots.length > 0 || children.length > 0) && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={pageUrl({ category: undefined, page: undefined })}
              className={`flex h-9 items-center rounded-full border px-3 text-sm transition-colors ${
                !sp.category
                  ? "border-(--sf-primary) bg-(--sf-primary) text-(--sf-on-primary)"
                  : "border-(--sf-border) text-(--sf-text) hover:border-(--sf-primary)"
              }`}
            >
              Всички
            </Link>
            {(children.length > 0 ? children : roots).map((category) => (
              <Link
                key={category.id}
                href={pageUrl({ category: category.id, page: undefined })}
                className={`flex h-9 items-center rounded-full border px-3 text-sm transition-colors ${
                  sp.category === category.id
                    ? "border-(--sf-primary) bg-(--sf-primary) text-(--sf-on-primary)"
                    : "border-(--sf-border) text-(--sf-text) hover:border-(--sf-primary)"
                }`}
              >
                {category.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-(--sf-muted)">
          {sp.search ? "Няма продукти, отговарящи на търсенето." : "Още няма продукти."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} base={base} />
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <div className="mt-8 flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={pageUrl({ page: String(page - 1) })}
              className="text-(--sf-primary) hover:underline"
            >
              ← Предишна
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={pageUrl({ page: String(page + 1) })}
              className="text-(--sf-primary) hover:underline"
            >
              Следваща →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

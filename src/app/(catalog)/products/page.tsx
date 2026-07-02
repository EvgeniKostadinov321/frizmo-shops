import type { Metadata } from "next";
import Link from "next/link";
import { CatalogProductCard } from "@/components/marketing/catalog-product-card";
import { Button, Input, Select } from "@/components/ui";
import { searchCatalogProducts } from "@/db/queries/catalog";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

export const metadata: Metadata = {
  title: "Продукти от малки български бизнеси — Frizmo Shops",
  description:
    "Разгледай продуктите на всички магазини във Frizmo Shops: храни, дрехи, ръчна изработка и още.",
};

interface PageProps {
  searchParams: Promise<{ search?: string; category?: string; promo?: string; page?: string }>;
}

export default async function ProductsCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;
  const promoOnly = sp.promo === "1";

  const { items, total, pageSize } = await searchCatalogProducts({
    search: sp.search,
    category: sp.category,
    promoOnly,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      search: sp.search,
      category: sp.category,
      promo: promoOnly ? "1" : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-ink-900">Всички продукти</h1>
      <p className="mt-1 text-ink-500">
        {total === 1 ? "1 продукт" : `${total} продукта`} от магазините във Frizmo Shops
      </p>

      <form action="/products" className="mt-6 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
        {promoOnly && <input type="hidden" name="promo" value="1" />}
        <Input
          label="Търсене на продукти"
          hideLabel
          type="search"
          name="search"
          defaultValue={sp.search}
          placeholder="Търси продукт..."
        />
        <Select
          label="Категория на магазина"
          hideLabel
          name="category"
          defaultValue={sp.category ?? ""}
          placeholder="Всички категории"
          options={BUSINESS_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Button type="submit">Търси</Button>
      </form>

      <div className="mt-3">
        <Link
          href={pageUrl({ promo: promoOnly ? undefined : "1", page: undefined })}
          className={`inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors ${
            promoOnly
              ? "border-warning-600 bg-warning-600 text-white"
              : "border-surface-300 text-ink-700 hover:border-warning-600"
          }`}
        >
          🏷 Само промоции
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="py-20 text-center text-ink-500">
          Няма продукти по тези критерии.{" "}
          <Link href="/products" className="text-brand-600 underline">
            Изчисти филтрите
          </Link>
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <CatalogProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="text-brand-600 hover:underline" href={pageUrl({ page: String(page - 1) })}>
              ← Предишна
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-500">
            Страница {page} от {totalPages}
          </span>
          {page < totalPages ? (
            <Link className="text-brand-600 hover:underline" href={pageUrl({ page: String(page + 1) })}>
              Следваща →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

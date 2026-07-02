import type { Metadata } from "next";
import Link from "next/link";
import { ShopCard } from "@/components/marketing/shop-card";
import { Button, Input, Select } from "@/components/ui";
import { getShopCities, searchShops } from "@/db/queries/catalog";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

export const metadata: Metadata = {
  title: "Каталог с онлайн магазини — Frizmo Shops",
  description:
    "Открий малки български бизнеси: храни, мода, ръчна изработка, козметика и още — всички на едно място.",
};

interface PageProps {
  searchParams: Promise<{ search?: string; category?: string; city?: string; page?: string }>;
}

export default async function ShopsCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;

  const [{ items, total, pageSize }, cities] = await Promise.all([
    searchShops({ search: sp.search, category: sp.category, city: sp.city, page }),
    getShopCities(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { search: sp.search, category: sp.category, city: sp.city, ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/shops?${qs}` : "/shops";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-ink-900">Открий магазини</h1>
      <p className="mt-1 text-ink-500">
        {total === 1 ? "1 магазин" : `${total} магазина`} от малки български бизнеси
      </p>

      <form action="/shops" className="mt-6 grid gap-3 sm:grid-cols-[1fr_180px_160px_auto]">
        <Input
          label="Търсене на магазини"
          hideLabel
          type="search"
          name="search"
          defaultValue={sp.search}
          placeholder="Търси магазин..."
        />
        <Select
          label="Категория"
          hideLabel
          name="category"
          defaultValue={sp.category ?? ""}
          placeholder="Всички категории"
          options={BUSINESS_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Select
          label="Град"
          hideLabel
          name="city"
          defaultValue={sp.city ?? ""}
          placeholder="Всички градове"
          options={cities.map((c) => ({ value: c, label: c }))}
        />
        <Button type="submit">Търси</Button>
      </form>

      {items.length === 0 ? (
        <p className="py-20 text-center text-ink-500">
          Няма магазини по тези критерии.{" "}
          <Link href="/shops" className="text-brand-600 underline">
            Изчисти филтрите
          </Link>
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
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

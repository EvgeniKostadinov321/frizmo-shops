import type { Metadata } from "next";
import { CatalogProductCard } from "@/components/marketing/catalog-product-card";
import { Button, Icon, Input, Select, TransitionLink } from "@/components/ui";
import { PriceStockFilter } from "@/components/price-stock-filter";
import { type ProductSort, searchCatalogProducts } from "@/db/queries/catalog";
import { toCents } from "@/lib/money";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

export const metadata: Metadata = {
  title: "Продукти от малки български бизнеси — Frizmo Shops",
  description:
    "Разгледай продуктите на всички магазини във Frizmo Shops: храни, дрехи, ръчна изработка и още.",
  openGraph: {
    title: "Продукти от малки български бизнеси — Frizmo Shops",
    description:
      "Разгледай продуктите на всички магазини във Frizmo Shops: храни, дрехи, ръчна изработка и още.",
  },
  /* Canonical към чистия URL (одит #4 SEO-03) — иначе всяка комбинация filter/sort/page е
     отделен индексируем дубликат. Огледало на storefront продуктовата страница. */
  alternates: { canonical: "/products" },
};

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Най-нови" },
  { value: "price-asc", label: "Цена: ниска → висока" },
  { value: "price-desc", label: "Цена: висока → ниска" },
  { value: "name", label: "Азбучен ред" },
];

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    promo?: string;
    min?: string;
    max?: string;
    inStock?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ProductsCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;
  const promoOnly = sp.promo === "1";
  /* Невалидна ценова стойност → игнорира се (null от toCents). */
  const minPrice = sp.min ? (toCents(sp.min) ?? undefined) : undefined;
  const maxPrice = sp.max ? (toCents(sp.max) ?? undefined) : undefined;
  const inStock = sp.inStock === "1";

  const { items, total, pageSize, sort } = await searchCatalogProducts({
    search: sp.search,
    category: sp.category,
    promoOnly,
    minPrice,
    maxPrice,
    inStock,
    sort: sp.sort as ProductSort | undefined,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      search: sp.search,
      category: sp.category,
      promo: promoOnly ? "1" : undefined,
      min: sp.min,
      max: sp.max,
      inStock: inStock ? "1" : undefined,
      sort: sp.sort,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  /* Активни филтри като чипове — всеки маха само себе си */
  const activeChips = [
    sp.search && { label: `„${sp.search}"`, remove: pageUrl({ search: undefined, page: undefined }) },
    sp.category && { label: sp.category, remove: pageUrl({ category: undefined, page: undefined }) },
    promoOnly && { label: "Промоции", remove: pageUrl({ promo: undefined, page: undefined }) },
    (sp.min || sp.max) && {
      label: `Цена ${sp.min ? `от ${sp.min} €` : ""}${sp.min && sp.max ? " " : ""}${sp.max ? `до ${sp.max} €` : ""}`,
      remove: pageUrl({ min: undefined, max: undefined, page: undefined }),
    },
    inStock && { label: "В наличност", remove: pageUrl({ inStock: undefined, page: undefined }) },
  ].filter(Boolean) as { label: string; remove: string }[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      {/* Hero зона */}
      <div className="max-w-2xl">
        <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
          <span className="shrink-0">Каталог</span>
          <span aria-hidden className="h-px flex-1 bg-surface-200" />
        </p>
        <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
          Всички продукти
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-700">
          Разгледай продуктите на всички магазини във Frizmo Shops — храни, мода, ръчна
          изработка, козметика и още.
        </p>
      </div>

      {/* Филтри */}
      <form action="/products" className="mt-10 grid gap-3 sm:grid-cols-[1fr_180px_190px_auto]">
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
        <Select label="Подредба" hideLabel name="sort" defaultValue={sort} options={SORT_OPTIONS} />
        <Button type="submit">Търси</Button>
        <div className="sm:col-span-4">
          <PriceStockFilter
            variant="catalog"
            defaultMin={sp.min}
            defaultMax={sp.max}
            defaultInStock={inStock}
          />
        </div>
      </form>

      {/* Само промоции — toggle */}
      <div className="mt-4">
        <TransitionLink
          href={pageUrl({ promo: promoOnly ? undefined : "1", page: undefined })}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
            promoOnly
              ? "border-brand-600 bg-brand-600 text-surface-0"
              : "border-surface-200 bg-surface-0 text-ink-700 hover:border-surface-300 hover:text-ink-900"
          }`}
        >
          <Icon name="trending-up" size={15} />
          Само промоции
        </TransitionLink>
      </div>

      {/* Активни филтри + брой резултати */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-500">
          {total === 1 ? "1 продукт" : `${total} продукта`}
        </span>
        {activeChips.length > 0 && (
          <>
            <span aria-hidden className="text-surface-300">
              ·
            </span>
            {activeChips.map((chip) => (
              <TransitionLink
                key={chip.label}
                href={chip.remove}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-0 py-1 pl-3 pr-2 text-xs font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900"
              >
                {chip.label}
                <Icon name="x" size={13} className="text-ink-500" />
              </TransitionLink>
            ))}
            <TransitionLink
              href="/products"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Изчисти всички
            </TransitionLink>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface-100 text-ink-500">
            <Icon name="search" size={28} />
          </span>
          <div>
            <p className="font-bold text-ink-900">Няма продукти по тези критерии</p>
            <p className="mt-1 text-sm text-ink-500">Опитай с други филтри или изчисти търсенето.</p>
          </div>
          <TransitionLink
            href="/products"
            className="inline-flex h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-bold text-surface-0 transition-transform hover:-translate-y-0.5"
          >
            Изчисти филтрите
          </TransitionLink>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <CatalogProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-between border-t border-surface-200 pt-6 text-sm">
          {page > 1 ? (
            <TransitionLink
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-surface-200 bg-surface-0 px-4 font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900"
              href={pageUrl({ page: String(page - 1) })}
            >
              ← Предишна
            </TransitionLink>
          ) : (
            <span />
          )}
          <span className="text-ink-500">
            Страница {page} от {totalPages}
          </span>
          {page < totalPages ? (
            <TransitionLink
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-surface-200 bg-surface-0 px-4 font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900"
              href={pageUrl({ page: String(page + 1) })}
            >
              Следваща →
            </TransitionLink>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

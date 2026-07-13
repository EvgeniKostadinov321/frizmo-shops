import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, TransitionLink } from "@/components/ui";
import { collectDescendantIds } from "@/lib/category-tree";
import { toCents } from "@/lib/money";
import { MascotState } from "@/components/storefront/mascot";
import { ProductCard } from "@/components/storefront/product-card";
import { StorefrontProductToolbar } from "@/components/storefront/product-toolbar";
import { getBuyerFavoriteIds } from "@/db/queries/buyer";
import { getReviewAggregates } from "@/db/queries/reviews";
import {
  getActiveProducts,
  getPublicCategories,
  getPublicShop,
  type ProductSort,
} from "@/db/queries/storefront";
import { createSupabaseServer } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    search?: string;
    category?: string;
    min?: string;
    max?: string;
    inStock?: string;
    page?: string;
    sort?: string;
  }>;
}

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "new", label: "Най-нови" },
  { value: "price-asc", label: "Цена ↑" },
  { value: "price-desc", label: "Цена ↓" },
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  const desc = `Разгледай всички продукти от ${result.shop.name}.`;
  return {
    title: `Продукти — ${result.shop.name}`,
    description: desc,
    /* Canonical към чистия каталог (без filter/sort/page query) — иначе всяка
       комбинация филтри е отделен индексируем URL → дублирано съдържание. */
    alternates: { canonical: `/s/${slug}/products` },
    openGraph: { title: `Продукти — ${result.shop.name}`, description: desc },
  };
}

export default async function StorefrontProductsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;
  const base = `/s/${shop.slug}`;

  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;
  const sort: ProductSort =
    sp.sort === "price-asc" || sp.sort === "price-desc" ? sp.sort : "new";
  /* Невалидна ценова стойност → игнорира се (null от toCents). */
  const minPrice = sp.min ? (toCents(sp.min) ?? undefined) : undefined;
  const maxPrice = sp.max ? (toCents(sp.max) ?? undefined) : undefined;
  const inStock = sp.inStock === "1";
  /* Категориите се зареждат първо — за да включим наследниците на избрана
     категория във филтъра (Д2: избор на родител показва всичко от поддървото). */
  const categories = await getPublicCategories(shop.id);
  const categoryIds = sp.category ? collectDescendantIds(categories, sp.category) : undefined;

  const { items, hasMore, total } = await getActiveProducts(shop.id, {
    search: sp.search,
    categoryId: sp.category,
    categoryIds,
    minPrice,
    maxPrice,
    inStock,
    page,
    sort,
  });
  /* S1: една заявка за звездите на всички карти на страницата (без N+1). */
  const ratings = await getReviewAggregates(items.map((p) => p.id));
  /* Любими на логнатия купувач (една заявка за цялата страница) → сърцето пази в акаунта. */
  const {
    data: { user },
  } = await (await createSupabaseServer()).auth.getUser();
  const favoriteIds = user ? new Set(await getBuyerFavoriteIds(user.id)) : new Set<string>();

  const activeCategory = categories.find((c) => c.id === sp.category);
  const hasFilters = Boolean(sp.search || sp.category || sp.sort || sp.min || sp.max || sp.inStock);

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      search: sp.search,
      category: sp.category,
      min: sp.min,
      max: sp.max,
      inStock: inStock ? "1" : undefined,
      sort: sp.sort,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "new") params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${base}/products?${qs}` : `${base}/products`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      {/* Заглавие вляво + търсачка (десктоп вдясно, мобилно отдолу) */}
      <header className="mb-8 border-b border-(--sf-border) pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
              Магазин
            </p>
            <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.05] text-(--sf-text)">
              {activeCategory ? activeCategory.name : "Всички продукти"}
            </h1>
            <p className="mt-2 text-sm text-(--sf-muted)">
              {sp.search
                ? `${total} ${total === 1 ? "резултат" : "резултата"} за „${sp.search}“`
                : `${total} ${total === 1 ? "продукт" : "продукта"}`}
            </p>
          </div>

          {/* Търсене: лупа в input, × за изчистване, submit с Enter */}
          <form
            action={`${base}/products`}
            className="relative w-full lg:w-80 lg:shrink-0"
          >
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.sort && sp.sort !== "new" && <input type="hidden" name="sort" value={sp.sort} />}
            {sp.min && <input type="hidden" name="min" value={sp.min} />}
            {sp.max && <input type="hidden" name="max" value={sp.max} />}
            {inStock && <input type="hidden" name="inStock" value="1" />}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-(--sf-muted)"
            >
              <Icon name="search" size={18} />
            </span>
            <input
              type="search"
              name="search"
              defaultValue={sp.search}
              placeholder="Търси в магазина…"
              aria-label="Търсене на продукти"
              enterKeyHint="search"
              className="h-11 w-full rounded-full border border-(--sf-border) bg-(--sf-surface-raised) pl-10 pr-10 text-(--sf-text) shadow-(--sf-shadow) transition-colors placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
            />
            {sp.search && (
              <Link
                href={pageUrl({ search: undefined, page: undefined })}
                aria-label="Изчисти търсенето"
                className="absolute inset-y-0 right-1 flex w-10 items-center justify-center text-(--sf-muted) hover:text-(--sf-text)"
              >
                <Icon name="x" size={16} />
              </Link>
            )}
          </form>
        </div>
      </header>

      <StorefrontProductToolbar
        base={base}
        sp={sp}
        sort={sort}
        inStock={inStock}
        sortOptions={SORT_OPTIONS}
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}
      />

      {items.length === 0 ? (
        <MascotState
          icon={sp.search ? "search" : "products"}
          logoPath={shop.logoPath}
          title={hasFilters ? "Нищо не намерихме" : "Още няма продукти"}
          text={
            sp.search
              ? `Няма продукти, отговарящи на „${sp.search}“. Опитай с друга дума.`
              : hasFilters
                ? "Няма продукти по тези филтри. Опитай с други стойности."
                : "Магазинът скоро ще добави продукти — намини пак."
          }
          action={
            hasFilters ? (
              <TransitionLink
                href={`${base}/products`}
                className="inline-flex h-11 items-center rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-5 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
              >
                Изчисти филтрите
              </TransitionLink>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              base={base}
              rating={ratings.get(product.id) ?? null}
              loggedIn={Boolean(user)}
              favorited={favoriteIds.has(product.id)}
            />
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Страници" className="mt-10 flex items-center justify-center gap-3">
          {page > 1 ? (
            <TransitionLink
              href={pageUrl({ page: page === 2 ? undefined : String(page - 1) })}
              className="inline-flex h-11 items-center gap-1.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-4 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
            >
              ← Предишна
            </TransitionLink>
          ) : (
            <span className="inline-flex h-11 items-center rounded-(--sf-radius) border border-(--sf-border) px-4 text-(--sf-muted) opacity-50">
              ← Предишна
            </span>
          )}
          <span className="px-2 text-sm text-(--sf-muted)">Страница {page}</span>
          {hasMore ? (
            <TransitionLink
              href={pageUrl({ page: String(page + 1) })}
              className="inline-flex h-11 items-center gap-1.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-4 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
            >
              Следваща →
            </TransitionLink>
          ) : (
            <span className="inline-flex h-11 items-center rounded-(--sf-radius) border border-(--sf-border) px-4 text-(--sf-muted) opacity-50">
              Следваща →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

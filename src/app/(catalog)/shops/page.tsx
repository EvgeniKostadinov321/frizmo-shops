import type { Metadata } from "next";
import { ShopCard } from "@/components/marketing/shop-card";
import { Button, Icon, Input, Select, TransitionLink } from "@/components/ui";
import { getShopCities, searchShops, type ShopSort } from "@/db/queries/catalog";
import { getBuyerFavoriteShopIds } from "@/db/queries/buyer-global";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

export const metadata: Metadata = {
  title: "Каталог с онлайн магазини — Frizmo Shops",
  description:
    "Открий малки български бизнеси: храни, мода, ръчна изработка, козметика и още — всички на едно място.",
  openGraph: {
    title: "Каталог с онлайн магазини — Frizmo Shops",
    description:
      "Открий малки български бизнеси: храни, мода, ръчна изработка, козметика и още — всички на едно място.",
  },
  /* Canonical към чистия URL (одит #4 SEO-03) — filter/sort/page да не се индексират като дубликати. */
  alternates: { canonical: "/shops" },
};

const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: "newest", label: "Най-нови" },
  { value: "name", label: "Азбучен ред" },
  { value: "city", label: "По град" },
];

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    city?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ShopsCatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = sp.page ? Math.max(1, Number(sp.page) || 1) : 1;

  const [{ items, total, pageSize, sort }, cities] = await Promise.all([
    searchShops({
      search: sp.search,
      category: sp.category,
      city: sp.city,
      sort: sp.sort as ShopSort | undefined,
      page,
    }),
    getShopCities(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  /* Сърце „любим магазин" — само за логнати купувачи (една заявка за страницата). */
  const {
    data: { user },
  } = await (await createSupabaseServer()).auth.getUser();
  const favoriteShopIds = user
    ? new Set(await getBuyerFavoriteShopIds(user.id))
    : new Set<string>();

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      search: sp.search,
      category: sp.category,
      city: sp.city,
      sort: sp.sort,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/shops?${qs}` : "/shops";
  }

  /* Активни филтри като чипове — всеки маха само себе си */
  const activeChips = [
    sp.search && { label: `„${sp.search}"`, remove: pageUrl({ search: undefined, page: undefined }) },
    sp.category && { label: sp.category, remove: pageUrl({ category: undefined, page: undefined }) },
    sp.city && { label: sp.city, remove: pageUrl({ city: undefined, page: undefined }) },
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
          Открий магазини
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-700">
          Малки български бизнеси — храни, мода, ръчна изработка, козметика и още. Всички
          на едно място.
        </p>
      </div>

      {/* Филтри */}
      <form action="/shops" className="mt-10 grid gap-3 sm:grid-cols-[1fr_170px_160px_160px_auto]">
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
        <Select
          label="Подредба"
          hideLabel
          name="sort"
          defaultValue={sort}
          options={SORT_OPTIONS}
        />
        <Button type="submit">Търси</Button>
      </form>

      {/* Активни филтри + брой резултати */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-500">
          {total === 1 ? "1 магазин" : `${total} магазина`}
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
            <TransitionLink href="/shops" className="text-xs font-medium text-brand-600 hover:text-brand-700">
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
            <p className="font-bold text-ink-900">Няма магазини по тези критерии</p>
            <p className="mt-1 text-sm text-ink-500">Опитай с други филтри или изчисти търсенето.</p>
          </div>
          <TransitionLink
            href="/shops"
            className="inline-flex h-11 items-center rounded-full bg-ink-900 px-6 text-sm font-bold text-surface-0 transition-transform hover:-translate-y-0.5"
          >
            Изчисти филтрите
          </TransitionLink>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              coverImage={shop.coverImage}
              loggedIn={Boolean(user)}
              favorited={favoriteShopIds.has(shop.id)}
            />
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

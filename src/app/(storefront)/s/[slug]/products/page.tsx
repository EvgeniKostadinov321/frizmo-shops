import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui";
import { MascotState } from "@/components/storefront/mascot";
import { PageHeader } from "@/components/storefront/page-header";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getActiveProducts,
  getPublicCategories,
  getPublicShop,
  type ProductSort,
} from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ search?: string; category?: string; page?: string; sort?: string }>;
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
  return { title: `Продукти — ${result.shop.name}` };
}

/** Чип-линк за филтри/сортиране — 36px висок, pill, активен = плътен primary. */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors ${
        active
          ? "border-(--sf-primary) bg-(--sf-primary) font-medium text-(--sf-on-primary)"
          : "border-(--sf-border) bg-(--sf-surface-raised) text-(--sf-text) hover:border-(--sf-primary)"
      }`}
    >
      {children}
    </Link>
  );
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
  const [{ items, hasMore, total }, categories] = await Promise.all([
    getActiveProducts(shop.id, { search: sp.search, categoryId: sp.category, page, sort }),
    getPublicCategories(shop.id),
  ]);

  const roots = categories.filter((c) => c.parentId === null);
  const activeCategory = categories.find((c) => c.id === sp.category);
  /* Активният корен: избраната категория или родителят ѝ — така при избрана
     подкатегория останалите сестрински подкатегории остават видими. */
  const activeRootId = activeCategory?.parentId ?? activeCategory?.id;
  const children = activeRootId
    ? categories.filter((c) => c.parentId === activeRootId)
    : [];
  const hasFilters = Boolean(sp.search || sp.category || sp.sort);

  function pageUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { search: sp.search, category: sp.category, sort: sp.sort, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "new") params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${base}/products?${qs}` : `${base}/products`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <PageHeader
        kicker="Магазин"
        title={activeCategory ? activeCategory.name : "Всички продукти"}
        intro={
          sp.search
            ? `${total} ${total === 1 ? "резултат" : "резултата"} за „${sp.search}“`
            : `${total} ${total === 1 ? "продукт" : "продукта"}`
        }
      />

      <div className="mb-8 flex flex-col gap-4">
        {/* Търсене: лупа в самия input, изчистване с ×, submit с Enter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form action={`${base}/products`} className="relative w-full max-w-md">
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.sort && sp.sort !== "new" && <input type="hidden" name="sort" value={sp.sort} />}
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

          {/* Сортиране — server-side чипове, без JS */}
          <div className="flex items-center gap-2" role="group" aria-label="Сортиране">
            <span className="hidden text-xs uppercase tracking-[0.14em] text-(--sf-muted) sm:block">
              Подреди
            </span>
            {SORT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                href={pageUrl({ sort: opt.value === "new" ? undefined : opt.value, page: undefined })}
                active={sort === opt.value}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        {roots.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Chip href={pageUrl({ category: undefined, page: undefined })} active={!sp.category}>
                Всички
              </Chip>
              {roots.map((category) => (
                <Chip
                  key={category.id}
                  href={pageUrl({ category: category.id, page: undefined })}
                  active={sp.category === category.id || activeRootId === category.id}
                >
                  {category.name}
                </Chip>
              ))}
            </div>
            {children.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-l-2 border-(--sf-border) pl-3">
                {children.map((category) => (
                  <Chip
                    key={category.id}
                    href={pageUrl({ category: category.id, page: undefined })}
                    active={sp.category === category.id}
                  >
                    {category.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <MascotState
          icon={sp.search ? "search" : "products"}
          logoPath={shop.logoPath}
          title={sp.search ? "Нищо не намерихме" : "Още няма продукти"}
          text={
            sp.search
              ? `Няма продукти, отговарящи на „${sp.search}“. Опитай с друга дума.`
              : "Магазинът скоро ще добави продукти — намини пак."
          }
          action={
            hasFilters ? (
              <Link
                href={`${base}/products`}
                className="inline-flex h-11 items-center rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-5 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
              >
                Изчисти филтрите
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} base={base} />
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Страници" className="mt-10 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={pageUrl({ page: page === 2 ? undefined : String(page - 1) })}
              className="inline-flex h-11 items-center gap-1.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-4 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
            >
              ← Предишна
            </Link>
          ) : (
            <span className="inline-flex h-11 items-center rounded-(--sf-radius) border border-(--sf-border) px-4 text-(--sf-muted) opacity-50">
              ← Предишна
            </span>
          )}
          <span className="px-2 text-sm text-(--sf-muted)">Страница {page}</span>
          {hasMore ? (
            <Link
              href={pageUrl({ page: String(page + 1) })}
              className="inline-flex h-11 items-center gap-1.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-4 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
            >
              Следваща →
            </Link>
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

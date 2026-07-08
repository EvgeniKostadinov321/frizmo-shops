import { ReviewsManager } from "@/components/dashboard/reviews-manager";
import { TransitionLink } from "@/components/ui";
import { getShopReviews } from "@/db/queries/reviews";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Ревюта — Frizmo Shops" };

interface ReviewsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const FILTERS = [
  { value: "", label: "Всички" },
  { value: "pending", label: "Чакащи" },
  { value: "approved", label: "Публикувани" },
] as const;

/** S1: модерация на ревюта — предварителна (pending не се вижда публично). */
export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const { shop } = await requireShop();
  const params = await searchParams;
  const status =
    params.status === "pending" || params.status === "approved" ? params.status : undefined;
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1;

  const { items, total, pageSize } = await getShopReviews(shop.id, { status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterUrl = (value: string, p?: number) => {
    const sp = new URLSearchParams();
    if (value) sp.set("status", value);
    if (p && p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/dashboard/reviews?${qs}` : "/dashboard/reviews";
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Ревюта</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ревютата се публикуват в магазина само след твоето одобрение.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? "") === f.value;
          return (
            <TransitionLink
              key={f.value}
              href={filterUrl(f.value)}
              aria-current={active ? "true" : undefined}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                active
                  ? "border-brand-600 bg-brand-600 text-surface-0"
                  : "border-surface-200 bg-surface-0 text-ink-700 hover:border-surface-300 hover:text-ink-900"
              }`}
            >
              {f.label}
            </TransitionLink>
          );
        })}
      </div>

      <ReviewsManager items={items} shopSlug={shop.slug} statusFilter={status ?? ""} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <TransitionLink
              href={filterUrl(status ?? "", page - 1)}
              className="font-medium text-brand-600 hover:text-brand-700"
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
              href={filterUrl(status ?? "", page + 1)}
              className="font-medium text-brand-600 hover:text-brand-700"
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

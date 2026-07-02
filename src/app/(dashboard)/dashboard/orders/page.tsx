import Link from "next/link";
import { OrderStatusBadge, ORDER_STATUS_LABELS } from "@/components/dashboard/order-status-badge";
import { EmptyState, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import { getOrders } from "@/db/queries/orders";
import { requireShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Поръчки — Frizmo Shops" };

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { shop } = await requireShop();
  const params = await searchParams;
  const { items, total, page, pageSize } = await getOrders(shop.id, {
    status: params.status,
    page: params.page ? Number(params.page) : 1,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statusFilters = [
    { value: "", label: "Всички" },
    ...Object.entries(ORDER_STATUS_LABELS).map(([value, meta]) => ({
      value,
      label: meta.label,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Поръчки</h1>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((f) => {
          const active = (params.status ?? "") === f.value;
          return (
            <Link
              key={f.value}
              href={f.value ? `/dashboard/orders?status=${f.value}` : "/dashboard/orders"}
              className={`flex h-9 items-center rounded-full border px-3 text-sm transition-colors ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-surface-300 text-ink-700 hover:border-brand-500"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={params.status ? "Няма поръчки с този статус" : "Още нямаш поръчки"}
          description="Когато клиент направи поръчка от магазина ти, тя ще се появи тук — с имейл и известие до теб."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TH>№</TH>
              <TH>Дата</TH>
              <TH>Клиент</TH>
              <TH>Сума</TH>
              <TH>Статус</TH>
            </THead>
            <TBody>
              {items.map((order) => (
                <TRow key={order.id}>
                  <TCell>
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="font-medium hover:text-brand-600"
                    >
                      #{String(order.orderNumber).padStart(4, "0")}
                    </Link>
                  </TCell>
                  <TCell className="text-ink-500">{dateFormat.format(order.createdAt)}</TCell>
                  <TCell>
                    <span className="block max-w-40 truncate">{order.customerName}</span>
                  </TCell>
                  <TCell className="font-medium">{formatPrice(order.totalCents)}</TCell>
                  <TCell>
                    <OrderStatusBadge status={order.status} />
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link
                  className="text-brand-600 hover:underline"
                  href={`/dashboard/orders?page=${page - 1}${params.status ? `&status=${params.status}` : ""}`}
                >
                  ← Предишна
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-500">
                Страница {page} от {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  className="text-brand-600 hover:underline"
                  href={`/dashboard/orders?page=${page + 1}${params.status ? `&status=${params.status}` : ""}`}
                >
                  Следваща →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

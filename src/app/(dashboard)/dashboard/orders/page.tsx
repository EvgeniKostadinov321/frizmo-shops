import Link from "next/link";
import { OrderStatusBadge, ORDER_STATUS_LABELS } from "@/components/dashboard/order-status-badge";
import { OrderSearch } from "@/components/dashboard/order-search";
import { OrderStatusFilter } from "@/components/dashboard/order-status-filter";
import { EmptyState, Table, TableRowLink, TBody, TCell, TH, THead } from "@/components/ui";
import { getOrders } from "@/db/queries/orders";
import { requireShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Поръчки — Frizmo Shops" };

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
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
    search: params.q,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* Пагинационните линкове носят активните status + q. */
  const pageQuery = (p: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    if (params.status) sp.set("status", params.status);
    if (params.q) sp.set("q", params.q);
    return `/dashboard/orders?${sp.toString()}`;
  };

  const statusOptions = [
    { value: "", label: "Всички статуси" },
    ...Object.entries(ORDER_STATUS_LABELS).map(([value, meta]) => ({
      value,
      label: meta.label,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Поръчки</h1>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:max-w-xs sm:flex-1">
          <OrderSearch />
        </div>
        <div className="sm:max-w-xs">
          <OrderStatusFilter options={statusOptions} value={params.status ?? ""} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={
            params.q
              ? "Няма поръчки с този критерий"
              : params.status
                ? "Няма поръчки с този статус"
                : "Още нямаш поръчки"
          }
          description={
            params.q
              ? "Опитай друг номер, име или телефон."
              : "Когато клиент направи поръчка от магазина ти, тя ще се появи тук — с имейл и известие до теб."
          }
        />
      ) : (
        <>
          {/* Мобилно: карти (таблицата е за десктоп) */}
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-card border border-surface-200 bg-surface-0 p-4 transition-colors hover:border-brand-500"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums text-ink-900">
                        #{String(order.orderNumber).padStart(4, "0")}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-700">{order.customerName}</p>
                    <p className="text-xs text-ink-500">{dateFormat.format(order.createdAt)}</p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-ink-900">
                    {formatPrice(order.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Десктоп: таблица */}
          <Table className="hidden md:block">
            <THead>
              <TH>№</TH>
              <TH>Дата</TH>
              <TH>Клиент</TH>
              <TH>Сума</TH>
              <TH>Статус</TH>
            </THead>
            <TBody>
              {items.map((order) => {
                const number = `#${String(order.orderNumber).padStart(4, "0")}`;
                return (
                  <TableRowLink key={order.id} href={`/dashboard/orders/${order.id}`}>
                    <TCell>
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {number}
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
                  </TableRowLink>
                );
              })}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link className="text-brand-600 hover:underline" href={pageQuery(page - 1)}>
                  ← Предишна
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-500">
                Страница {page} от {totalPages}
              </span>
              {page < totalPages ? (
                <Link className="text-brand-600 hover:underline" href={pageQuery(page + 1)}>
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

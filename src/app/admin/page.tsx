import type { Metadata } from "next";
import Link from "next/link";
import { AdminShopActions } from "@/components/dashboard/admin-shop-actions";
import { Badge, Card, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import { getAdminShops, getPlatformStats } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Админ — Frizmo Shops", robots: { index: false } };

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

const STATUS_META: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  draft: { label: "Чернова", tone: "neutral" },
  published: { label: "Публикуван", tone: "success" },
  suspended: { label: "Скрит", tone: "warning" },
  blocked: { label: "Блокиран", tone: "danger" },
};

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "short" });

export default async function AdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;

  const [stats, { items, total, page, pageSize }] = await Promise.all([
    getPlatformStats(),
    getAdminShops({
      search: sp.search,
      status: sp.status,
      page: sp.page ? Number(sp.page) : 1,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">Платформен админ</h1>
        <Link href="/dashboard" className="text-sm text-brand-600 hover:underline">
          ← Към моя магазин
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <p className="text-sm text-ink-500">Магазини</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.totalShops}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Публикувани</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.publishedShops}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Търговци</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.totalMerchants}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Поръчки</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.totalOrders}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Оборот (GMV)</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {formatPrice(stats.totalRevenueCents)}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ value: "", label: "Всички" }, ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))].map(
          (f) => {
            const active = (sp.status ?? "") === f.value;
            return (
              <Link
                key={f.value}
                href={f.value ? `/admin?status=${f.value}` : "/admin"}
                className={`flex h-9 items-center rounded-full border px-3 text-sm transition-colors ${
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-surface-300 text-ink-700 hover:border-brand-500"
                }`}
              >
                {f.label}
              </Link>
            );
          },
        )}
      </div>

      <Table>
        <THead>
          <TH>Магазин</TH>
          <TH>Собственик</TH>
          <TH>Статус</TH>
          <TH>Продукти</TH>
          <TH>Поръчки</TH>
          <TH>Създаден</TH>
          <TH aria-label="Действия" />
        </THead>
        <TBody>
          {items.map((shop) => {
            const meta = STATUS_META[shop.status] ?? STATUS_META.draft!;
            return (
              <TRow key={shop.id}>
                <TCell>
                  <a
                    href={`/s/${shop.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:text-brand-600"
                  >
                    {shop.name}
                  </a>
                  <span className="block text-xs text-ink-500">{shop.businessCategory}</span>
                </TCell>
                <TCell className="max-w-48 truncate text-ink-500">{shop.ownerEmail}</TCell>
                <TCell>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </TCell>
                <TCell>{shop.productCount}</TCell>
                <TCell>{shop.orderCount}</TCell>
                <TCell className="text-ink-500">{dateFormat.format(shop.createdAt)}</TCell>
                <TCell>
                  <AdminShopActions shopId={shop.id} status={shop.status} name={shop.name} />
                </TCell>
              </TRow>
            );
          })}
        </TBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="text-brand-600 hover:underline" href={`/admin?page=${page - 1}${sp.status ? `&status=${sp.status}` : ""}`}>
              ← Предишна
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-500">
            Страница {page} от {totalPages}
          </span>
          {page < totalPages ? (
            <Link className="text-brand-600 hover:underline" href={`/admin?page=${page + 1}${sp.status ? `&status=${sp.status}` : ""}`}>
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

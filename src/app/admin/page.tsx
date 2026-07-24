import type { Metadata } from "next";
import Link from "next/link";
import { AdminMonetization } from "@/components/dashboard/admin-monetization";
import { AdminOrdersTable } from "@/components/dashboard/admin-orders-table";
import { AdminPager } from "@/components/dashboard/admin-pager";
import { AdminShopActions } from "@/components/dashboard/admin-shop-actions";
import { AdminInvoiceRetry } from "@/components/dashboard/admin-invoice-actions";
import { AdminUsersTable } from "@/components/dashboard/admin-users-table";
import { Badge, Card, Table, Tabs, TabPanel, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import {
  getAdminShops,
  getFeeInvoicesList,
  getFeeLedger,
  getMonetizationStats,
  getPlatformOrders,
  getPlatformStats,
  getProblemInvBgInvoices,
} from "@/db/queries/admin";
import { getAdminUsers } from "@/db/queries/admin-users";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Админ — Frizmo Shops", robots: { index: false } };

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    status?: string;
    page?: string;
    orderStatus?: string;
    orderPage?: string;
    invPage?: string;
    userPage?: string;
  }>;
}

const STATUS_META: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  draft: { label: "Чернова", tone: "neutral" },
  published: { label: "Публикуван", tone: "success" },
  suspended: { label: "Скрит", tone: "warning" },
  blocked: { label: "Блокиран", tone: "danger" },
};

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "short" });
const invPeriod = new Intl.DateTimeFormat("bg-BG", { month: "long", year: "numeric" });

export default async function AdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const sp = await searchParams;

  const [
    stats,
    { items, total, page, pageSize },
    problemInvoices,
    monetization,
    feeInvoices,
    feeLedger,
    users,
    platformOrders,
  ] = await Promise.all([
    getPlatformStats(),
    getAdminShops({ search: sp.search, status: sp.status, page: sp.page ? Number(sp.page) : 1 }),
    getProblemInvBgInvoices(),
    getMonetizationStats(),
    getFeeInvoicesList(sp.invPage ? Number(sp.invPage) : 1),
    getFeeLedger(30),
    getAdminUsers(sp.userPage ? Number(sp.userPage) : 1),
    getPlatformOrders({ status: sp.orderStatus, page: sp.orderPage ? Number(sp.orderPage) : 1 }),
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

      <Tabs
        ariaLabel="Админ панел"
        tabs={[
          { key: "overview", label: "Общ преглед" },
          { key: "shops", label: "Магазини" },
          { key: "monetization", label: "Монетизация" },
          { key: "users", label: "Потребители" },
          { key: "orders", label: "Поръчки" },
        ]}
      >
        {/* ── Общ преглед ── */}
        <TabPanel tabKey="overview">
          <div className="flex flex-col gap-4">
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <p className="text-sm text-ink-500">Начислени такси</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">
                  {formatPrice(monetization.totalChargedCents)}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-ink-500">Неплатени фактури</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">{monetization.unpaidCount}</p>
              </Card>
              <Card>
                <p className="text-sm text-ink-500">Дължимо (неплатено)</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">
                  {formatPrice(monetization.unpaidCents)}
                </p>
              </Card>
            </div>

            {/* Проблемни inv.bg фактури: платена такса без официален документ. */}
            {problemInvoices.length > 0 && (
              <Card className="flex flex-col gap-3 border-warning-600/30">
                <h2 className="font-bold text-ink-900">
                  Фактури за преиздаване ({problemInvoices.length})
                </h2>
                <Table>
                  <THead>
                    <TH>Магазин</TH>
                    <TH>Период</TH>
                    <TH>Сума</TH>
                    <TH>Статус</TH>
                    <TH aria-label="Действия" />
                  </THead>
                  <TBody>
                    {problemInvoices.map((inv) => (
                      <TRow key={inv.id}>
                        <TCell className="font-medium text-ink-900">{inv.shopName}</TCell>
                        <TCell>{invPeriod.format(inv.periodStart)}</TCell>
                        <TCell className="tabular-nums">{formatPrice(inv.amountDueCents)}</TCell>
                        <TCell>
                          <Badge tone={inv.invBgStatus === "failed" ? "danger" : "warning"}>
                            {inv.invBgStatus === "failed" ? "Провал" : "Няма данни"}
                          </Badge>
                        </TCell>
                        <TCell>
                          <AdminInvoiceRetry feeInvoiceId={inv.id} />
                        </TCell>
                      </TRow>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </div>
        </TabPanel>

        {/* ── Магазини ── */}
        <TabPanel tabKey="shops">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "Всички" },
                ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
              ].map((f) => {
                const active = (sp.status ?? "") === f.value;
                const href = f.value
                  ? `/admin?tab=shops&status=${f.value}`
                  : "/admin?tab=shops";
                return (
                  <Link
                    key={f.value}
                    href={href}
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
                  <Link
                    className="text-brand-600 hover:underline"
                    href={`/admin?tab=shops&page=${page - 1}${sp.status ? `&status=${sp.status}` : ""}`}
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
                    href={`/admin?tab=shops&page=${page + 1}${sp.status ? `&status=${sp.status}` : ""}`}
                  >
                    Следваща →
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        </TabPanel>

        {/* ── Монетизация ── */}
        <TabPanel tabKey="monetization">
          <div className="flex flex-col gap-4">
            <AdminMonetization
              stats={monetization}
              invoices={feeInvoices.items}
              ledger={feeLedger}
            />
            <AdminPager
              page={feeInvoices.page}
              total={feeInvoices.total}
              pageSize={feeInvoices.pageSize}
              paramName="invPage"
              baseParams="tab=monetization"
            />
          </div>
        </TabPanel>

        {/* ── Потребители ── */}
        <TabPanel tabKey="users">
          <div className="flex flex-col gap-4">
            <AdminUsersTable users={users.items} />
            <AdminPager
              page={users.page}
              total={users.total}
              pageSize={users.pageSize}
              paramName="userPage"
              baseParams="tab=users"
            />
          </div>
        </TabPanel>

        {/* ── Поръчки ── */}
        <TabPanel tabKey="orders">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "Всички" },
                { value: "new", label: "Нови" },
                { value: "confirmed", label: "Потвърдени" },
                { value: "shipped", label: "Изпратени" },
                { value: "completed", label: "Завършени" },
                { value: "cancelled", label: "Отказани" },
                { value: "pending_payment", label: "Чакат плащане" },
              ].map((f) => {
                const active = (sp.orderStatus ?? "") === f.value;
                const href = f.value
                  ? `/admin?tab=orders&orderStatus=${f.value}`
                  : "/admin?tab=orders";
                return (
                  <Link
                    key={f.value}
                    href={href}
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
            <AdminOrdersTable orders={platformOrders.items} />
            <AdminPager
              page={platformOrders.page}
              total={platformOrders.total}
              pageSize={platformOrders.pageSize}
              paramName="orderPage"
              baseParams={sp.orderStatus ? `tab=orders&orderStatus=${sp.orderStatus}` : "tab=orders"}
            />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

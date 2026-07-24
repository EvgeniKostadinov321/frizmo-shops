import { sql as rawSql } from "drizzle-orm";
import { db } from "@/db";

export const ADMIN_PAGE_SIZE = 20;

export interface PlatformStats {
  totalShops: number;
  publishedShops: number;
  totalOrders: number;
  totalRevenueCents: number;
  totalMerchants: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const rows = (await db.execute(rawSql`
    select
      (select count(*) from shops) as total_shops,
      (select count(*) from shops where status = 'published') as published_shops,
      (select count(*) from orders) as total_orders,
      (select coalesce(sum(total_cents), 0) from orders where status <> 'cancelled') as total_revenue,
      (select count(*) from profiles) as total_merchants
  `)) as unknown as Record<string, unknown>[];
  const row = rows[0] ?? {};
  return {
    totalShops: Number(row.total_shops ?? 0),
    publishedShops: Number(row.published_shops ?? 0),
    totalOrders: Number(row.total_orders ?? 0),
    totalRevenueCents: Number(row.total_revenue ?? 0),
    totalMerchants: Number(row.total_merchants ?? 0),
  };
}

export interface AdminShopRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  businessCategory: string;
  ownerEmail: string;
  productCount: number;
  orderCount: number;
  createdAt: Date;
}

export async function getAdminShops(filters: {
  search?: string;
  status?: string;
  page?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const search = filters.search ? `%${filters.search}%` : null;
  const status = filters.status || null;

  /* Raw SQL: имейлът живее в auth.users, извън Drizzle схемата. */
  const rows = (await db.execute(rawSql`
    select s.id, s.name, s.slug, s.status, s.business_category,
      coalesce(u.email, '—') as owner_email, s.created_at,
      (select count(*) from products p where p.shop_id = s.id) as product_count,
      (select count(*) from orders o where o.shop_id = s.id) as order_count
    from shops s
    left join auth.users u on u.id = s.owner_id
    where (${search}::text is null or s.name ilike ${search} or u.email ilike ${search})
      and (${status}::text is null or s.status = ${status}::shop_status)
    order by s.created_at desc
    limit ${ADMIN_PAGE_SIZE} offset ${offset}
  `)) as unknown as Record<string, unknown>[];

  const countRows = (await db.execute(rawSql`
    select count(*) as total from shops s
    left join auth.users u on u.id = s.owner_id
    where (${search}::text is null or s.name ilike ${search} or u.email ilike ${search})
      and (${status}::text is null or s.status = ${status}::shop_status)
  `)) as unknown as Record<string, unknown>[];

  const items: AdminShopRow[] = rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    status: String(r.status),
    businessCategory: String(r.business_category),
    ownerEmail: String(r.owner_email),
    productCount: Number(r.product_count),
    orderCount: Number(r.order_count),
    createdAt: new Date(String(r.created_at)),
  }));

  return { items, total: Number(countRows[0]?.total ?? 0), page, pageSize: ADMIN_PAGE_SIZE };
}

export interface ProblemInvoiceRow {
  id: string;
  shopName: string;
  periodStart: Date;
  amountDueCents: number;
  invBgStatus: string;
}

/** inv.bg фактури с проблем (failed/skipped, без издаден документ) — за админ ръчна намеса. */
export async function getProblemInvBgInvoices(): Promise<ProblemInvoiceRow[]> {
  const rows = (await db.execute(rawSql`
    select fi.id, s.name as shop_name, fi.period_start, fi.amount_due_cents, fi.inv_bg_status
    from fee_invoices fi
    join shops s on s.id = fi.shop_id
    where fi.status = 'paid'
      and fi.inv_bg_id is null
      and fi.inv_bg_status in ('failed', 'skipped')
    order by fi.period_start desc
    limit 100
  `)) as unknown as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    shopName: String(r.shop_name),
    periodStart: new Date(String(r.period_start)),
    amountDueCents: Number(r.amount_due_cents),
    invBgStatus: String(r.inv_bg_status),
  }));
}

/* ─── Монетизация (супер-админ таб) ─── */

export interface MonetizationStats {
  totalChargedCents: number;
  totalCreditsCents: number;
  unpaidCount: number;
  unpaidCents: number;
}

/** Обобщени такси: начислено, кредитирано (връщания), неплатени фактури (status≠paid). */
export async function getMonetizationStats(): Promise<MonetizationStats> {
  const rows = (await db.execute(rawSql`
    select
      (select coalesce(sum(amount_cents), 0) from fee_events where type = 'charge') as total_charged,
      (select coalesce(sum(amount_cents), 0) from fee_events where type = 'credit') as total_credits,
      (select count(*) from fee_invoices where status <> 'paid') as unpaid_count,
      (select coalesce(sum(amount_due_cents), 0) from fee_invoices where status <> 'paid') as unpaid_cents
  `)) as unknown as Record<string, unknown>[];
  const r = rows[0] ?? {};
  return {
    totalChargedCents: Number(r.total_charged ?? 0),
    totalCreditsCents: Number(r.total_credits ?? 0),
    unpaidCount: Number(r.unpaid_count ?? 0),
    unpaidCents: Number(r.unpaid_cents ?? 0),
  };
}

export const ADMIN_INV_PAGE_SIZE = 20;

export interface FeeInvoiceRow {
  id: string;
  shopName: string;
  periodStart: Date;
  amountDueCents: number;
  status: string;
  invBgStatus: string | null;
  chargesCents: number;
  creditsCents: number;
}

/** Списък месечни фактури (неплатени първо, после по период низходящо). */
export async function getFeeInvoicesList(page = 1) {
  const offset = (Math.max(1, page) - 1) * ADMIN_INV_PAGE_SIZE;
  const rows = (await db.execute(rawSql`
    select fi.id, s.name as shop_name, fi.period_start, fi.amount_due_cents,
           fi.status, fi.inv_bg_status, fi.charges_cents, fi.credits_cents
    from fee_invoices fi
    left join shops s on s.id = fi.shop_id
    order by (fi.status <> 'paid') desc, fi.period_start desc
    limit ${ADMIN_INV_PAGE_SIZE} offset ${offset}
  `)) as unknown as Record<string, unknown>[];
  const countRows = (await db.execute(
    rawSql`select count(*)::int as total from fee_invoices`,
  )) as unknown as { total: number }[];
  const items: FeeInvoiceRow[] = rows.map((r) => ({
    id: String(r.id),
    shopName: (r.shop_name as string) ?? "—",
    periodStart: new Date(String(r.period_start)),
    amountDueCents: Number(r.amount_due_cents),
    status: String(r.status),
    invBgStatus: r.inv_bg_status ? String(r.inv_bg_status) : null,
    chargesCents: Number(r.charges_cents),
    creditsCents: Number(r.credits_cents),
  }));
  return { items, total: Number(countRows[0]?.total ?? 0), page: Math.max(1, page), pageSize: ADMIN_INV_PAGE_SIZE };
}

export interface FeeLedgerRow {
  id: string;
  shopName: string;
  type: "charge" | "credit";
  amountCents: number;
  baseCents: number;
  occurredAt: Date;
}

/** Последни fee_events (начисления/кредити) за наблюдение. */
export async function getFeeLedger(limit = 30): Promise<FeeLedgerRow[]> {
  const rows = (await db.execute(rawSql`
    select fe.id, s.name as shop_name, fe.type, fe.amount_cents, fe.base_cents, fe.created_at
    from fee_events fe
    left join shops s on s.id = fe.shop_id
    order by fe.created_at desc
    limit ${limit}
  `)) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    shopName: (r.shop_name as string) ?? "—",
    type: r.type as "charge" | "credit",
    amountCents: Number(r.amount_cents),
    baseCents: Number(r.base_cents),
    occurredAt: new Date(String(r.created_at)),
  }));
}

/* ─── Платформени поръчки (супер-админ таб) ─── */

export const ADMIN_ORDER_PAGE_SIZE = 25;

const ORDER_STATUSES = [
  "new",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
  "pending_payment",
];

export interface PlatformOrderRow {
  id: string;
  orderNumber: number;
  shopName: string;
  totalCents: number;
  status: string;
  paymentType: string;
  createdAt: Date;
}

/** Последни поръчки през ЦЯЛАТА платформа (по избор филтрирани по статус). */
export async function getPlatformOrders(filters: { page?: number; status?: string }) {
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * ADMIN_ORDER_PAGE_SIZE;
  const statusOk = filters.status ? ORDER_STATUSES.includes(filters.status) : false;
  const whereClause = statusOk ? rawSql`where o.status = ${filters.status}` : rawSql``;
  const rows = (await db.execute(rawSql`
    select o.id, o.order_number, s.name as shop_name, o.total_cents, o.status, o.payment_type, o.created_at
    from orders o
    left join shops s on s.id = o.shop_id
    ${whereClause}
    order by o.created_at desc
    limit ${ADMIN_ORDER_PAGE_SIZE} offset ${offset}
  `)) as unknown as Record<string, unknown>[];
  const countRows = (await db.execute(
    rawSql`select count(*)::int as total from orders o ${whereClause}`,
  )) as unknown as { total: number }[];
  const items: PlatformOrderRow[] = rows.map((r) => ({
    id: String(r.id),
    orderNumber: Number(r.order_number),
    shopName: (r.shop_name as string) ?? "—",
    totalCents: Number(r.total_cents),
    status: String(r.status),
    paymentType: String(r.payment_type),
    createdAt: new Date(String(r.created_at)),
  }));
  return { items, total: Number(countRows[0]?.total ?? 0), page, pageSize: ADMIN_ORDER_PAGE_SIZE };
}

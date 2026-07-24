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

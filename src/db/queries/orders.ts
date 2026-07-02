import { and, count, desc, eq, gte, ne, sql as rawSql, type SQL } from "drizzle-orm";
import { db, orderItems, orders } from "@/db";

export const ORDERS_PAGE_SIZE = 20;

export async function getOrders(
  shopId: string,
  filters: { status?: string; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(orders.shopId, shopId)];
  if (
    filters.status &&
    ["new", "confirmed", "shipped", "completed", "cancelled"].includes(filters.status)
  ) {
    conditions.push(eq(orders.status, filters.status as typeof orders.status.enumValues[number]));
  }
  const where = and(...conditions);

  const [items, [total]] = await Promise.all([
    db.query.orders.findMany({
      where,
      orderBy: [desc(orders.createdAt)],
      limit: ORDERS_PAGE_SIZE,
      offset: (page - 1) * ORDERS_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(orders).where(where),
  ]);

  return { items, total: total?.value ?? 0, page, pageSize: ORDERS_PAGE_SIZE };
}

export async function getOrderWithItems(orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return null;
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });
  return { ...order, items };
}

export async function countNewOrders(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "new")));
  return row?.value ?? 0;
}

/** Приходи за текущия календарен месец (без отказаните). */
export async function getMonthRevenue(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: rawSql<number>`coalesce(sum(total_cents), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        ne(orders.status, "cancelled"),
        gte(orders.createdAt, rawSql`date_trunc('month', now())`),
      ),
    );
  return Number(row?.value ?? 0);
}

import { and, count, desc, eq, gte, ilike, notInArray, or, sql as rawSql, type SQL } from "drizzle-orm";
import { db, orderItems, orders } from "@/db";

export const ORDERS_PAGE_SIZE = 20;

/** Статуси, които НЕ носят приход (отказ + прието връщане). Общ за всички сметки. */
export const EXCLUDED_FROM_REVENUE = ["cancelled", "returned"] as const;

export async function getOrders(
  shopId: string,
  filters: { status?: string; page?: number; search?: string } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [eq(orders.shopId, shopId)];
  if (
    filters.status &&
    ["new", "confirmed", "shipped", "completed", "cancelled", "return_requested", "returned"].includes(filters.status)
  ) {
    conditions.push(eq(orders.status, filters.status as typeof orders.status.enumValues[number]));
  }

  /* Търсене по номер / име / телефон. Едно OR-условие, добавено с AND към
     tenant + статус. Телефонът е E.164 в базата → търсим по цифрите на заявката
     (частична цифра работи). Чисто число → и точен orderNumber. */
  const q = (filters.search ?? "").trim().slice(0, 60);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const orParts: SQL[] = [ilike(orders.customerName, `%${q}%`)];
    if (digits) orParts.push(ilike(orders.customerPhone, `%${digits}%`));
    /* „#0012" / „0012" / „12" → orderNumber = 12 (само ако цялата заявка е число). */
    if (/^#?0*\d+$/.test(q)) {
      const n = Number(digits);
      if (Number.isInteger(n) && n > 0) orParts.push(eq(orders.orderNumber, n));
    }
    conditions.push(or(...orParts)!);
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

/** Приходи за текущия календарен месец (без отказани и върнати). */
export async function getMonthRevenue(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: rawSql<number>`coalesce(sum(total_cents), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        notInArray(orders.status, [...EXCLUDED_FROM_REVENUE]),
        gte(orders.createdAt, rawSql`date_trunc('month', now())`),
      ),
    );
  return Number(row?.value ?? 0);
}

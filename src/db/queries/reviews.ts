import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, orderItems, orders, products, reviews } from "@/db";

export const REVIEWS_PAGE_SIZE = 10;

/** Одобрените ревюта на продукт (публично, най-нови първи). */
export async function getApprovedReviews(productId: string, page = 1) {
  const safePage = Math.max(1, page);
  const where = and(eq(reviews.productId, productId), eq(reviews.status, "approved"));
  const [items, [total]] = await Promise.all([
    db.query.reviews.findMany({
      where,
      orderBy: [desc(reviews.createdAt)],
      limit: REVIEWS_PAGE_SIZE,
      offset: (safePage - 1) * REVIEWS_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(reviews).where(where),
  ]);
  return { items, total: total?.value ?? 0, page: safePage, pageSize: REVIEWS_PAGE_SIZE };
}

/**
 * Има ли този телефон (e164) реална поръчка на дадения продукт в магазина —
 * за verified ревю. Статуси: confirmed/shipped/completed (реална покупка).
 */
export async function hasPurchasedProduct(
  shopId: string,
  phoneE164: string,
  productId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.shopId, shopId),
        eq(orders.customerPhone, phoneE164),
        inArray(orders.status, ["confirmed", "shipped", "completed"]),
        eq(orderItems.productId, productId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export interface ReviewAggregate {
  avg: number;
  count: number;
}

/** Агрегати (средна оценка + брой approved) за списък продукти — една заявка. */
export async function getReviewAggregates(
  productIds: string[],
): Promise<Map<string, ReviewAggregate>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      productId: reviews.productId,
      avg: sql<number>`avg(${reviews.rating})::float`,
      count: count(),
    })
    .from(reviews)
    .where(and(inArray(reviews.productId, productIds), eq(reviews.status, "approved")))
    .groupBy(reviews.productId);
  return new Map(rows.map((r) => [r.productId, { avg: Number(r.avg), count: r.count }]));
}

/** Ревютата на магазина за модерация (pending първи по подразбиране). */
export async function getShopReviews(
  shopId: string,
  filters: { status?: "pending" | "approved"; page?: number } = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const conditions = [eq(reviews.shopId, shopId)];
  if (filters.status) conditions.push(eq(reviews.status, filters.status));
  const where = and(...conditions);

  const pageSize = REVIEWS_PAGE_SIZE * 2;
  const [rows, [total]] = await Promise.all([
    db
      .select({ review: reviews, productName: products.name, productSlug: products.slug })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(reviews).where(where),
  ]);
  const items = rows.map((r) => ({
    ...r.review,
    productName: r.productName,
    productSlug: r.productSlug,
  }));
  return { items, total: total?.value ?? 0, page, pageSize };
}

/** Брой чакащи ревюта — за badge-а в навигацията. */
export async function countPendingReviews(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(reviews)
    .where(and(eq(reviews.shopId, shopId), eq(reviews.status, "pending")));
  return row?.value ?? 0;
}

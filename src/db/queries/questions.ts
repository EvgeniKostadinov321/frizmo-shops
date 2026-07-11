import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db, products, productQuestions } from "@/db";

export const QUESTIONS_PAGE_SIZE = 10;

/** Отговорени въпроси за продукт (публично, най-нови първи), пагинирано. */
export async function getAnsweredQuestions(productId: string, page = 1) {
  const safePage = Math.max(1, page);
  const where = and(
    eq(productQuestions.productId, productId),
    eq(productQuestions.status, "answered"),
  );
  const [items, [total]] = await Promise.all([
    db.query.productQuestions.findMany({
      where,
      orderBy: [desc(productQuestions.createdAt)],
      limit: QUESTIONS_PAGE_SIZE,
      offset: (safePage - 1) * QUESTIONS_PAGE_SIZE,
    }),
    db.select({ value: count() }).from(productQuestions).where(where),
  ]);
  return { items, total: total?.value ?? 0, page: safePage, pageSize: QUESTIONS_PAGE_SIZE };
}

/** Всички въпроси на магазина (dashboard), pending най-отгоре, после най-нови първи. */
export async function getShopQuestions(shopId: string) {
  const rows = await db
    .select({ question: productQuestions, productName: products.name, productSlug: products.slug })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .where(eq(productQuestions.shopId, shopId))
    .orderBy(
      /* pending (0) преди answered (1), после най-нови първи. */
      asc(sql`case when ${productQuestions.status} = 'pending' then 0 else 1 end`),
      desc(productQuestions.createdAt),
    );
  return rows.map((r) => ({
    ...r.question,
    productName: r.productName,
    productSlug: r.productSlug,
  }));
}

/** Брой чакащи (pending) — за nav badge. */
export async function countPendingQuestions(shopId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(productQuestions)
    .where(and(eq(productQuestions.shopId, shopId), eq(productQuestions.status, "pending")));
  return row?.value ?? 0;
}

export type ShopQuestion = Awaited<ReturnType<typeof getShopQuestions>>[number];

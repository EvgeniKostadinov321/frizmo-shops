import { and, asc, eq } from "drizzle-orm";
import { db, sizeGuides } from "@/db";

/** Всички размерни таблици на магазина (dashboard списък + dropdown във формата). */
export async function getSizeGuides(shopId: string) {
  return db.query.sizeGuides.findMany({
    where: eq(sizeGuides.shopId, shopId),
    orderBy: [asc(sizeGuides.sortOrder), asc(sizeGuides.createdAt)],
  });
}

/** Една таблица, филтрирана по shopId (собственост). null ако липсва/чужда. */
export async function getSizeGuide(shopId: string, id: string) {
  const guide = await db.query.sizeGuides.findFirst({
    where: and(eq(sizeGuides.id, id), eq(sizeGuides.shopId, shopId)),
  });
  return guide ?? null;
}

export type SizeGuide = Awaited<ReturnType<typeof getSizeGuides>>[number];

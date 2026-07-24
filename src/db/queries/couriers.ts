import { and, eq } from "drizzle-orm";
import { courierDeliveryOptions, courierOffices, db, shopCourierAccounts } from "@/db";
import type { CourierId } from "@/lib/couriers";

/** Всички куриерски акаунти на магазина (за таба „Куриери"). */
export async function getCourierAccounts(shopId: string) {
  return db.query.shopCourierAccounts.findMany({
    where: eq(shopCourierAccounts.shopId, shopId),
  });
}

/** Настройките на куриерска доставка (за таба „Куриери" — всички, вкл. неактивните). */
export async function getCourierDeliveryOptions(shopId: string) {
  return db.query.courierDeliveryOptions.findMany({
    where: eq(courierDeliveryOptions.shopId, shopId),
  });
}

/** Само активните настройки на куриерска доставка (за checkout методите). */
export async function getActiveCourierDeliveryOptions(shopId: string) {
  return db.query.courierDeliveryOptions.findMany({
    where: and(
      eq(courierDeliveryOptions.shopId, shopId),
      eq(courierDeliveryOptions.active, true),
    ),
  });
}

/** Един акаунт (за генериране на товарителница). */
export async function getCourierAccount(shopId: string, provider: CourierId) {
  return db.query.shopCourierAccounts.findFirst({
    where: and(
      eq(shopCourierAccounts.shopId, shopId),
      eq(shopCourierAccounts.provider, provider),
    ),
  });
}

/** Кеширани офиси по град (за checkout picker-а). */
export async function searchCachedOffices(provider: CourierId, city: string) {
  const target = city.trim().toLowerCase();
  const rows = await db.query.courierOffices.findMany({
    where: eq(courierOffices.provider, provider),
  });
  return rows.filter((o) => o.city.toLowerCase().includes(target)).slice(0, 50);
}

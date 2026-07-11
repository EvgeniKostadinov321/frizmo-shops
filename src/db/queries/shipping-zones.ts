import { asc, eq } from "drizzle-orm";
import { db, shippingZones, type ShippingZone } from "@/db";

/** Всички зони на магазина (подредени), за групиране по метод в UI. */
export async function getZonesForShop(shopId: string): Promise<ShippingZone[]> {
  return db.query.shippingZones.findMany({
    where: eq(shippingZones.shopId, shopId),
    orderBy: [asc(shippingZones.sortOrder), asc(shippingZones.createdAt)],
  });
}

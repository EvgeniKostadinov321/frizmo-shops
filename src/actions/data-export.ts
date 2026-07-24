"use server";

import { eq } from "drizzle-orm";
import {
  db,
  buyerAddresses,
  buyerFavorites,
  buyerFavoriteShops,
  feeEvents,
  feeInvoices,
  merchantBillingDetails,
  orders,
  profiles,
  shops,
  subscriptions,
} from "@/db";
import { requireBuyer, requireShop } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/** Макс експорти на потребител на час (M3 — предпазва от спам на unbounded заявки). */
const EXPORT_MAX = 5;
const EXPORT_WINDOW_SEC = 3600;

/**
 * GDPR чл.20 — преносимост на данните. Сваляне на СВОИТЕ лични данни като JSON.
 * Два обхвата по роля. Връща JSON string (клиентът го сваля като файл).
 */

interface ExportEnvelope {
  exportedAt: string;
  subject: "buyer" | "merchant";
  data: Record<string, unknown>;
}

/** Данните на КУПУВАЧА: профил + свои поръчки + адреси + любими. */
export async function exportBuyerData(): Promise<string> {
  const { user } = await requireBuyer();
  if (!(await checkRateLimit(`export:${user.id}`, EXPORT_MAX, EXPORT_WINDOW_SEC))) {
    throw new Error("Твърде много заявки. Опитай пак по-късно.");
  }

  const [profile, myOrders, addresses, favProducts, favShops] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, user.id) }),
    db.query.orders.findMany({ where: eq(orders.buyerId, user.id) }),
    db.query.buyerAddresses.findMany({ where: eq(buyerAddresses.buyerId, user.id) }),
    db.query.buyerFavorites.findMany({ where: eq(buyerFavorites.buyerId, user.id) }),
    db.query.buyerFavoriteShops.findMany({ where: eq(buyerFavoriteShops.buyerId, user.id) }),
  ]);

  const envelope: ExportEnvelope = {
    exportedAt: new Date().toISOString(),
    subject: "buyer",
    data: {
      profile: { email: user.email, ...profile },
      orders: myOrders,
      addresses,
      favoriteProducts: favProducts,
      favoriteShops: favShops,
    },
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Данните на ТЪРГОВЕЦА: профил + магазин + данъчни данни + свои фактури + абонамент.
 * ⚠️ НЕ включва клиентски PII (поръчки/абонати на клиентите му) — той е техен обработващ,
 * не субект на тези данни; те не влизат в неговия личен експорт.
 */
export async function exportMerchantData(): Promise<string> {
  const { user, shop } = await requireShop();
  if (!(await checkRateLimit(`export:${user.id}`, EXPORT_MAX, EXPORT_WINDOW_SEC))) {
    throw new Error("Твърде много заявки. Опитай пак по-късно.");
  }

  const [profile, billingDetails, invoices, events, subscription] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, user.id) }),
    db.query.merchantBillingDetails.findFirst({ where: eq(merchantBillingDetails.shopId, shop.id) }),
    db.query.feeInvoices.findMany({ where: eq(feeInvoices.shopId, shop.id) }),
    db.query.feeEvents.findMany({ where: eq(feeEvents.shopId, shop.id) }),
    db.query.subscriptions.findFirst({ where: eq(subscriptions.shopId, shop.id) }),
  ]);
  const shopRow = await db.query.shops.findFirst({ where: eq(shops.id, shop.id) });

  const envelope: ExportEnvelope = {
    exportedAt: new Date().toISOString(),
    subject: "merchant",
    data: {
      profile: { email: user.email, ...profile },
      shop: shopRow,
      billingDetails,
      feeInvoices: invoices,
      feeEvents: events,
      subscription,
    },
  };
  return JSON.stringify(envelope, null, 2);
}

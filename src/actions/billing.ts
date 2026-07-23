"use server";

import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/db";
import { requireShop } from "@/lib/auth";
import { ok, type ActionResult } from "@/lib/action-result";
import { getFeeInvoices, hasOverdueFees } from "@/db/queries/fees";
import { requiresCard } from "@/lib/selling-gate";
import { getDefaultCard, type SavedCard } from "@/lib/stripe";

export interface FeeInvoiceView {
  id: string;
  periodStart: string;
  amountDueCents: number;
  status: string;
}

/**
 * Таксов статус за dashboard billing секцията (нов модел — без абонамент/планове):
 *  - needsCard: изисква ли се карта (след първата завършена продажба, но без запазена карта)
 *  - overdue: има ли просрочена фактура (спира продажби след grace)
 *  - card: запазената карта (за визуализация) или null
 *  - invoices: месечните фактури, най-новите първо
 */
export async function getBillingStatus(): Promise<
  ActionResult<{ needsCard: boolean; overdue: boolean; card: SavedCard | null; invoices: FeeInvoiceView[] }>
> {
  const { shop } = await requireShop();
  const [needsCard, overdue, invoices, sub] = await Promise.all([
    requiresCard(shop.id),
    hasOverdueFees(shop.id),
    getFeeInvoices(shop.id),
    db
      .select({ customerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shop.id))
      .limit(1)
      .then((r) => r[0]),
  ]);
  const card = sub?.customerId ? await getDefaultCard(sub.customerId) : null;
  return ok({
    needsCard,
    overdue,
    card,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      periodStart: inv.periodStart.toISOString(),
      amountDueCents: inv.amountDueCents,
      status: inv.status,
    })),
  });
}

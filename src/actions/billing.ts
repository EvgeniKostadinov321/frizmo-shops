"use server";

import { requireShop } from "@/lib/auth";
import { ok, type ActionResult } from "@/lib/action-result";
import { getFeeInvoices, hasOverdueFees } from "@/db/queries/fees";
import { requiresCard } from "@/lib/selling-gate";

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
 *  - invoices: месечните фактури, най-новите първо
 */
export async function getBillingStatus(): Promise<
  ActionResult<{ needsCard: boolean; overdue: boolean; invoices: FeeInvoiceView[] }>
> {
  const { shop } = await requireShop();
  const [needsCard, overdue, invoices] = await Promise.all([
    requiresCard(shop.id),
    hasOverdueFees(shop.id),
    getFeeInvoices(shop.id),
  ]);
  return ok({
    needsCard,
    overdue,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      periodStart: inv.periodStart.toISOString(),
      amountDueCents: inv.amountDueCents,
      status: inv.status,
    })),
  });
}

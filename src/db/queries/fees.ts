import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, feeEvents, feeInvoices } from "@/db";
import { feeBaseCents, feeCents, FEE_GRACE_DAYS } from "@/lib/fee";

/** Drizzle transaction client (същия shape като db за заявки). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Идемпотентен charge при завършена поръчка. baseCents = feeBaseCents(order);
 * amountCents = feeCents(base). onConflictDoNothing на (orderId,'charge').
 * Ако базата → такса 0, пак записваме реда (audit; balance е коректен).
 */
export async function recordFeeCharge(
  tx: Tx,
  order: {
    id: string;
    shopId: string;
    subtotalCents: number;
    discountCents: number;
    completedAt: Date;
  },
): Promise<void> {
  const base = feeBaseCents(order);
  const amount = feeCents(base);
  await tx
    .insert(feeEvents)
    .values({
      shopId: order.shopId,
      orderId: order.id,
      type: "charge",
      amountCents: amount,
      baseCents: base,
      occurredAt: order.completedAt,
    })
    .onConflictDoNothing({ target: [feeEvents.orderId, feeEvents.type] });
}

/**
 * Идемпотентен credit при прието връщане — САМО ако поръчката има charge.
 * Сумата = сумата на charge-а (сторниране 1:1). occurredAt = returnedAt.
 */
export async function recordFeeCredit(
  tx: Tx,
  order: { id: string; shopId: string; returnedAt: Date },
): Promise<void> {
  const [charge] = await tx
    .select({ amountCents: feeEvents.amountCents, baseCents: feeEvents.baseCents })
    .from(feeEvents)
    .where(and(eq(feeEvents.orderId, order.id), eq(feeEvents.type, "charge")));
  if (!charge) return; // няма charge → няма какво да се сторнира
  await tx
    .insert(feeEvents)
    .values({
      shopId: order.shopId,
      orderId: order.id,
      type: "credit",
      amountCents: charge.amountCents,
      baseCents: charge.baseCents,
      occurredAt: order.returnedAt,
    })
    .onConflictDoNothing({ target: [feeEvents.orderId, feeEvents.type] });
}

/** Баланс за период: сума charge − сума credit по occurredAt в [from, to). */
export async function getBillableBalanceForPeriod(
  shopId: string,
  from: Date,
  to: Date,
): Promise<{ chargesCents: number; creditsCents: number; amountDueCents: number }> {
  const [row] = await db
    .select({
      charges: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'charge' then ${feeEvents.amountCents} else 0 end), 0)`,
      credits: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'credit' then ${feeEvents.amountCents} else 0 end), 0)`,
    })
    .from(feeEvents)
    .where(
      and(
        eq(feeEvents.shopId, shopId),
        gte(feeEvents.occurredAt, from),
        lt(feeEvents.occurredAt, to),
      ),
    );
  const chargesCents = Number(row?.charges ?? 0);
  const creditsCents = Number(row?.credits ?? 0);
  return { chargesCents, creditsCents, amountDueCents: chargesCents - creditsCents };
}

/** Има ли просрочена (issued) фактура извън grace периода → блокира продажби. */
export async function hasOverdueFees(shopId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - FEE_GRACE_DAYS * 86_400_000);
  const [row] = await db
    .select({ id: feeInvoices.id })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.shopId, shopId),
        eq(feeInvoices.status, "issued"),
        lt(feeInvoices.createdAt, cutoff),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Фактурите на магазин (за dashboard billing секцията), най-новите първо. */
export async function getFeeInvoices(shopId: string) {
  return db
    .select()
    .from(feeInvoices)
    .where(eq(feeInvoices.shopId, shopId))
    .orderBy(sql`${feeInvoices.periodStart} desc`);
}

import { and, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db, feeEvents, feeInvoices, subscriptions } from "@/db";
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

/**
 * КУМУЛАТИВЕН баланс за фактуриране (одит #3 BL-01 — running balance, не календарен прозорец).
 * дължимо = (Σ charges − Σ credits за ВСИЧКИ събития с occurredAt < periodEnd)
 *         − (Σ вече издадени положителни фактури на магазина преди този период).
 *
 * Така кредит от прието връщане, попаднал в месец без продажби, НЕ се губи (както при
 * per-window агрегацията) — остава в кумулатива и покрива бъдещи такси, докато се изчерпа.
 * Спазва обещанието в условията (чл.3: „кредит в следваща фактура"). chargesCents/creditsCents
 * връщаме за ПЕРИОДА (одит на фактурата); amountDueCents е кумулативната нетна разлика.
 */
export async function getCumulativeBillableBalance(
  shopId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ chargesCents: number; creditsCents: number; amountDueCents: number }> {
  /* Такси/кредити САМО за периода — за chargesCents/creditsCents полетата на фактурата (одит). */
  const [periodRow] = await db
    .select({
      charges: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'charge' then ${feeEvents.amountCents} else 0 end), 0)`,
      credits: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'credit' then ${feeEvents.amountCents} else 0 end), 0)`,
    })
    .from(feeEvents)
    .where(
      and(
        eq(feeEvents.shopId, shopId),
        gte(feeEvents.occurredAt, periodStart),
        lt(feeEvents.occurredAt, periodEnd),
      ),
    );

  /* Кумулативен нетен баланс на целия ledger до края на периода. */
  const [cumRow] = await db
    .select({
      net: sql<number>`coalesce(sum(case when ${feeEvents.type} = 'charge' then ${feeEvents.amountCents} else -${feeEvents.amountCents} end), 0)`,
    })
    .from(feeEvents)
    .where(and(eq(feeEvents.shopId, shopId), lt(feeEvents.occurredAt, periodEnd)));

  /* Вече наплатено = сумата на всички ПРЕДИШНИ издадени положителни фактури (draft-ове с
     amountDue ≤ 0 не са теглени → не се броят; текущият период още няма ред). */
  const [paidRow] = await db
    .select({
      paid: sql<number>`coalesce(sum(${feeInvoices.amountDueCents}), 0)`,
    })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.shopId, shopId),
        lt(feeInvoices.periodStart, periodStart),
        gt(feeInvoices.amountDueCents, 0),
      ),
    );

  const chargesCents = Number(periodRow?.charges ?? 0);
  const creditsCents = Number(periodRow?.credits ?? 0);
  const cumulativeNet = Number(cumRow?.net ?? 0);
  const alreadyPaid = Number(paidRow?.paid ?? 0);
  return { chargesCents, creditsCents, amountDueCents: cumulativeNet - alreadyPaid };
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

/**
 * DB-състоянието за card-gate решението (чисто, без Stripe — за да остане fees.ts
 * непокътнат от server-only). `requiresCard` в selling-gate.ts комбинира това с
 * реалната Stripe default_payment_method проверка.
 *  - hasCharge: имало ли е ≥1 таксуема продажба (тогава изобщо се иска карта)
 *  - customerId: Stripe Customer id (null = още няма → сигурно иска карта)
 */
export async function cardState(
  shopId: string,
): Promise<{ hasCharge: boolean; customerId: string | null }> {
  const [charge] = await db
    .select({ id: feeEvents.id })
    .from(feeEvents)
    .where(and(eq(feeEvents.shopId, shopId), eq(feeEvents.type, "charge")))
    .limit(1);
  const [sub] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.shopId, shopId))
    .limit(1);
  return { hasCharge: Boolean(charge), customerId: sub?.customerId ?? null };
}

/** Брой charge събития за магазин (за „първа продажба" имейла — праща се точно веднъж). */
export async function countFeeCharges(shopId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(feeEvents)
    .where(and(eq(feeEvents.shopId, shopId), eq(feeEvents.type, "charge")));
  return Number(row?.n ?? 0);
}

/** Фактурите на магазин (за dashboard billing секцията), най-новите първо. */
export async function getFeeInvoices(shopId: string) {
  return db
    .select()
    .from(feeInvoices)
    .where(eq(feeInvoices.shopId, shopId))
    .orderBy(sql`${feeInvoices.periodStart} desc`);
}

/**
 * Идемпотентно записва фактурен ред за периода (billing cron). Връща реда (нов или
 * съществуващ) — onConflictDoNothing на (shopId, periodStart) пази от дубъл при повторно
 * пускане на cron-а. Записва се и при amountDue ≤ 0 (за одит; без Stripe фактура тогава).
 */
export async function recordInvoiceForPeriod(
  shopId: string,
  periodStart: Date,
  periodEnd: Date,
  balance: { chargesCents: number; creditsCents: number; amountDueCents: number },
) {
  await db
    .insert(feeInvoices)
    .values({
      shopId,
      periodStart,
      periodEnd,
      chargesCents: balance.chargesCents,
      creditsCents: balance.creditsCents,
      amountDueCents: balance.amountDueCents,
      status: "draft",
    })
    .onConflictDoNothing({ target: [feeInvoices.shopId, feeInvoices.periodStart] });
  const [row] = await db
    .select()
    .from(feeInvoices)
    .where(and(eq(feeInvoices.shopId, shopId), eq(feeInvoices.periodStart, periodStart)))
    .limit(1);
  return row;
}

/** Маркира фактура като issued + пази Stripe id (след успешно създаване на Stripe фактурата). */
export async function markInvoiceIssued(id: string, stripeInvoiceId: string) {
  await db
    .update(feeInvoices)
    .set({ status: "issued", stripeInvoiceId, updatedAt: new Date() })
    .where(eq(feeInvoices.id, id));
}

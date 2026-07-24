"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, feeInvoices, shops } from "@/db";
import { shopCacheTag } from "@/db/queries/storefront";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { issueInvBgForFeeInvoice } from "@/lib/invbg-issue";
import { annulInvBgInvoice } from "@/lib/invbg";

/**
 * Админ действия: скриване (suspended, обратимо към published) и блокиране
 * (blocked; отблокирането връща draft — търговецът публикува наново).
 * Данни не се трият никога.
 */
const TRANSITIONS: Record<string, { from: string[]; to: "published" | "suspended" | "blocked" | "draft" }> = {
  suspend: { from: ["published"], to: "suspended" },
  restore: { from: ["suspended"], to: "published" },
  block: { from: ["published", "suspended", "draft"], to: "blocked" },
  unblock: { from: ["blocked"], to: "draft" },
};

export async function setShopStatus(input: {
  shopId: string;
  action: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = z
    .object({ shopId: z.uuid(), action: z.enum(["suspend", "restore", "block", "unblock"]) })
    .safeParse(input);
  if (!parsed.success) return fail("Невалидна заявка.");

  const shop = await db.query.shops.findFirst({ where: eq(shops.id, parsed.data.shopId) });
  if (!shop) return fail("Магазинът не съществува.");

  const transition = TRANSITIONS[parsed.data.action]!;
  if (!transition.from.includes(shop.status)) {
    return fail(`Действието не е позволено от статус „${shop.status}“.`);
  }

  await db
    .update(shops)
    .set({ status: transition.to, updatedAt: new Date() })
    .where(eq(shops.id, shop.id));

  revalidatePath("/admin");
  revalidateTag(shopCacheTag(shop.slug), "max");
  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/shops");
  return ok(null);
}

/**
 * Админ: ръчно преиздаване на провалена/пропусната inv.bg фактура (т.2). Нулира
 * invBgStatus, за да мине атомарния claim, после опитва пак. forceProduction — за
 * жив тест (админ действие, съзнателно). Чете ТЕКУЩИТЕ данъчни данни (snapshot-ът
 * е бил замразен само при успех — тук може търговецът да е попълнил данните после).
 */
export async function retryInvBgInvoice(feeInvoiceId: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.uuid().safeParse(feeInvoiceId);
  if (!parsed.success) return fail("Невалидна заявка.");

  const invoice = await db.query.feeInvoices.findFirst({ where: eq(feeInvoices.id, parsed.data) });
  if (!invoice) return fail("Фактурата не съществува.");
  if (invoice.invBgId) return fail("Фактурата вече е издадена.");

  // Нулираме статуса, за да мине claim-ът (invBgId е null → реален POST още не е успял).
  await db
    .update(feeInvoices)
    .set({ invBgStatus: null, updatedAt: new Date() })
    .where(and(eq(feeInvoices.id, parsed.data), isNull(feeInvoices.invBgId)));

  const r = await issueInvBgForFeeInvoice(parsed.data, { forceProduction: true });
  revalidatePath("/admin");
  if (r.status === "issued") return ok(null);
  return fail(`Издаването не успя (${r.reason ?? r.status}).`);
}

/** Админ: анулира издадена inv.bg фактура (т.2) — в inv.bg + локален запис. */
export async function annulFeeInvoice(feeInvoiceId: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.uuid().safeParse(feeInvoiceId);
  if (!parsed.success) return fail("Невалидна заявка.");

  const invoice = await db.query.feeInvoices.findFirst({ where: eq(feeInvoices.id, parsed.data) });
  if (!invoice?.invBgId) return fail("Фактурата няма официален документ за анулиране.");
  if (invoice.invBgAnnulledAt) return fail("Фактурата вече е анулирана.");

  try {
    await annulInvBgInvoice(invoice.invBgId);
  } catch {
    return fail("Анулирането в inv.bg не успя. Опитай пак.");
  }
  await db
    .update(feeInvoices)
    .set({ invBgAnnulledAt: new Date(), updatedAt: new Date() })
    .where(eq(feeInvoices.id, parsed.data));
  revalidatePath("/admin");
  return ok(null);
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db, feeEvents, feeInvoices, profiles, shops, subscriptions } from "@/db";
import { shopCacheTag } from "@/db/queries/storefront";
import { confirmNameMatches } from "@/lib/account-deletion";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { SHOP_MEDIA_BUCKET } from "@/lib/storage";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

const schema = z.object({ confirmName: z.string().min(1).max(80) });
const GENERIC_FAIL = "Изтриването не бе успешно. Опитай пак или се свържи с нас.";

type AdminClient = ReturnType<typeof createSupabaseAdmin>;

/** Рекурсивно събира всички файлови пътища под даден префикс (папките нямат id). */
async function listAllFiles(admin: AdminClient, prefix: string): Promise<string[]> {
  const { data, error } = await admin.storage
    .from(SHOP_MEDIA_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const files: string[] = [];
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    // Папките в Supabase Storage идват без id (null) → рекурсия; файловете имат id.
    if (!entry.id) files.push(...(await listAllFiles(admin, path)));
    else files.push(path);
  }
  return files;
}

/** Best-effort триене на всички медия файлове на магазина. */
async function deleteShopMedia(admin: AdminClient, shopId: string): Promise<void> {
  const paths = await listAllFiles(admin, `shops/${shopId}`);
  if (paths.length > 0) await admin.storage.from(SHOP_MEDIA_BUCKET).remove(paths);
}

export async function deleteAccount(rawInput: unknown): Promise<ActionResult<null>> {
  const { user, shop } = await requireShop();

  const parsed = schema.safeParse(rawInput);
  if (!parsed.success || !confirmNameMatches(parsed.data.confirmName, shop.name)) {
    return fail("Името на магазина не съвпада.");
  }

  const logCtx = { action: "deleteAccount", shopId: shop.id, userId: user.id };

  try {
    /* Вземи Stripe sub id ПРЕДИ триенето (после го няма) — но отмени го чак СЛЕД
       успешния DB commit (H1: необратимите външни операции да не се случват преди
       транзакцията, за да не се загубят при rollback). */
    let stripeSubId: string | null = null;
    if (isStripeConfigured()) {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.shopId, shop.id),
        columns: { stripeSubscriptionId: true },
      });
      stripeSubId = sub?.stripeSubscriptionId ?? null;
    }

    // 1) DB триене в ЕДНА транзакция ПЪРВО (H1: при провал → rollback, нищо необратимо
    //    още не се е случило; данните остават възстановими).
    await db.transaction(async (tx) => {
      /* Архивирай данъчните записи ПРЕДИ триене на магазина: shopId→null, за да НЕ ги
         хване cascade-ът. НАП изисква 10г запазване (ЗСч/ЗДДС). fee_invoices пази данните
         в billing snapshot колоните; fee_events е самодостатъчен (amount/base/occurred).
         За fee_events махаме и orderId (поръчките се трият с магазина). Виж plan gdpr-package. */
      await tx.update(feeInvoices).set({ shopId: null }).where(eq(feeInvoices.shopId, shop.id));
      await tx.update(feeEvents).set({ shopId: null, orderId: null }).where(eq(feeEvents.shopId, shop.id));
      // Триене на магазина → каскадно зависимите таблици (fee_* вече откачени).
      await tx.delete(shops).where(eq(shops.id, shop.id));
      // Триене на профила → каскадно push_subscriptions.
      await tx.delete(profiles).where(eq(profiles.id, user.id));
    });

    /* 2) СЛЕД успешния commit — необратимите външни операции (best-effort, не блокират). */
    const admin = createSupabaseAdmin();
    // 2a) Отмени Stripe абонамента.
    if (stripeSubId) {
      try {
        await stripe.subscriptions.cancel(stripeSubId);
      } catch (e) {
        console.error(JSON.stringify({ ...logCtx, step: "stripeCancel", error: String(e) }));
      }
    }
    // 2b) Изтрий Storage файловете.
    try {
      await deleteShopMedia(admin, shop.id);
    } catch (e) {
      console.error(JSON.stringify({ ...logCtx, step: "storage", error: String(e) }));
    }
    // 2c) Изтрий auth записа.
    const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
    if (authErr) {
      console.error(JSON.stringify({ ...logCtx, step: "authDelete", error: authErr.message }));
    }

    // Инвалидирай публичния магазин (вече не съществува → 404).
    revalidateTag(shopCacheTag(shop.slug), "max");
    revalidatePath(`/s/${shop.slug}`, "layout");

    // Изчисти сесийната бисквитка (best-effort — сесията вече е невалидна).
    try {
      const supabase = await createSupabaseServer();
      await supabase.auth.signOut();
    } catch {
      /* игнорирай */
    }

    console.log(JSON.stringify({ ...logCtx, step: "done" }));
    return ok(null);
  } catch (e) {
    console.error(JSON.stringify({ ...logCtx, step: "fatal", error: String(e) }));
    return fail(GENERIC_FAIL);
  }
}

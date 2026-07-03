"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, shops } from "@/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";

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
  revalidatePath(`/s/${shop.slug}`, "layout");
  revalidatePath("/shops");
  return ok(null);
}

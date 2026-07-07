"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, shops, subscribers } from "@/db";
import { clientIp } from "@/actions/cart";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sendNewsletterConfirmEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

const subscribeSchema = z.object({
  email: z.email("Невалиден имейл"),
  /** Honeypot. */
  website: z.string().max(100).default(""),
});

/**
 * Публичен нюзлетър абонамент (double opt-in). Записва pending + праща
 * потвърждаващ имейл. Повторен имейл: confirmed → „вече си абониран";
 * pending → нов token + повторен имейл (без втори ред).
 */
export async function subscribeToNewsletter(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ alreadyConfirmed?: boolean }>> {
  const parsed = subscribeSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Невалиден имейл.");
  const input = parsed.data;

  /* Honeypot: ботът получава „успех". */
  if (input.website !== "") return ok({});

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") return fail("Магазинът не е достъпен.");

  const ip = await clientIp();
  if (!(await checkRateLimit(`sub:${ip}:${shop.id}`, 5, 3600))) {
    return fail("Твърде много опити. Опитай по-късно.");
  }

  const email = sanitizeText(input.email, 120).toLowerCase();

  /* Съществуващ вече потвърден → нищо не правим (без нов имейл). */
  const existing = await db.query.subscribers.findFirst({
    where: and(eq(subscribers.shopId, shop.id), eq(subscribers.email, email)),
  });
  if (existing?.status === "confirmed") {
    return ok({ alreadyConfirmed: true });
  }

  /* Нов или pending/unsubscribed → нов token + upsert към pending. */
  const token = randomUUID();
  await db
    .insert(subscribers)
    .values({ shopId: shop.id, email, token, status: "pending" })
    .onConflictDoUpdate({
      target: [subscribers.shopId, subscribers.email],
      set: { token, status: "pending", updatedAt: new Date() },
    });

  await sendNewsletterConfirmEmail({
    toEmail: email,
    shopName: shop.name,
    shopSlug: shop.slug,
    token,
  });

  return ok({});
}

const confirmSchema = z.object({
  shopSlug: z.string().max(120),
  token: z.uuid(),
  action: z.enum(["confirm", "unsubscribe"]).default("confirm"),
});

export type ConfirmResult = "confirmed" | "already" | "unsubscribed" | "invalid";

/**
 * Потвърждава/отписва абонамент по token. Мутацията е ТУК (не при рендиране на
 * страницата), за да не я задейства prefetch/preview на линка от имейл клиент.
 * Викана от бутон на страницата с потвърждение.
 */
export async function confirmNewsletter(rawInput: unknown): Promise<ConfirmResult> {
  const parsed = confirmSchema.safeParse(rawInput);
  if (!parsed.success) return "invalid";
  const { shopSlug, token, action } = parsed.data;

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop) return "invalid";

  const row = await db.query.subscribers.findFirst({
    where: and(eq(subscribers.shopId, shop.id), eq(subscribers.token, token)),
  });
  if (!row) return "invalid";

  if (action === "unsubscribe") {
    await db
      .update(subscribers)
      .set({ status: "unsubscribed", updatedAt: new Date() })
      .where(eq(subscribers.id, row.id));
    return "unsubscribed";
  }

  if (row.status === "confirmed") return "already";
  await db
    .update(subscribers)
    .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscribers.id, row.id));
  return "confirmed";
}

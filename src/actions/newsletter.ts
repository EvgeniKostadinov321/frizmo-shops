"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { campaigns, db, shops, subscribers } from "@/db";
import { clientIp } from "@/actions/cart";
import { revalidatePath } from "next/cache";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sendCampaignEmail, sendNewsletterConfirmEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";

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

const campaignSchema = z.object({
  subject: z.string().trim().min(3, "Въведи тема").max(120),
  body: z.string().trim().min(10, "Въведи съдържание").max(5000),
});

/**
 * S4: изпраща кампания до ВСИЧКИ потвърдени абонати на магазина. През
 * requireShop(); лимит 1 кампания/час (срещу двойно цъкане/спам). Всеки имейл
 * съдържа „Отпиши се" линк (token механизма). Записва историята с реалния
 * брой успешно изпратени.
 */
export async function sendCampaign(
  rawInput: unknown,
): Promise<ActionResult<{ sent: number; total: number }>> {
  const parsed = campaignSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);

  const { shop } = await requireShop();

  if (!(await checkRateLimit(`campaign:${shop.id}`, 1, 3600))) {
    return fail("Може да изпращаш най-много 1 кампания на час. Опитай по-късно.");
  }

  const recipients = await db.query.subscribers.findMany({
    where: and(eq(subscribers.shopId, shop.id), eq(subscribers.status, "confirmed")),
    columns: { email: true, token: true },
  });
  if (recipients.length === 0) return fail("Няма потвърдени абонати.");

  const subject = sanitizeText(parsed.data.subject, 120);
  const body = sanitizeMultiline(parsed.data.body, 5000);

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendCampaignEmail({
        toEmail: r.email,
        shopName: shop.name,
        shopSlug: shop.slug,
        subject,
        body,
        unsubscribeToken: r.token,
      }),
    ),
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;

  await db.insert(campaigns).values({ shopId: shop.id, subject, body, recipientCount: sent });

  revalidatePath("/dashboard/subscribers");
  return ok({ sent, total: recipients.length });
}

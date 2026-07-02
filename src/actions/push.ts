"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pushSubscriptions } from "@/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";

const subscriptionSchema = z.object({
  endpoint: z.url().max(500),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("Невалиден абонамент.");

  const user = await requireUser();
  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });

  return ok(null);
}

export async function deletePushSubscription(input: { endpoint: string }): Promise<ActionResult> {
  const parsed = z.object({ endpoint: z.string().max(500) }).safeParse(input);
  if (!parsed.success) return fail("Невалиден абонамент.");

  const user = await requireUser();
  const sub = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, parsed.data.endpoint),
  });
  if (sub && sub.userId === user.id) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
  }
  return ok(null);
}

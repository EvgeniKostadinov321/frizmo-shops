import { isAuthorizedCron } from "@/lib/cron-auth";
import { getDueAbandonedCarts, markAbandonedCartSent } from "@/db/queries/abandoned-cart";
import { sendAbandonedCartEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Vercel Cron (всеки час): намира зрелите изоставени колички (>1ч, pending),
 * праща по 1 напомнящ имейл и ги маркира sent. Гард с CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return new Response("Unauthorized", { status: 401 });

  const due = await getDueAbandonedCarts(HOUR_MS, 100);
  let sent = 0;
  let failed = 0;

  for (const cart of due) {
    try {
      await sendAbandonedCartEmail({
        toEmail: cart.email,
        shopName: cart.shopName,
        shopSlug: cart.shopSlug,
        lines: cart.lines,
        subtotalCents: cart.subtotalCents,
      });
      await markAbandonedCartSent(cart.id);
      sent++;
    } catch (err) {
      failed++;
      console.error(
        JSON.stringify({ event: "abandoned_cart_send_failed", id: cart.id, err: String(err) }),
      );
    }
  }

  return Response.json({ processed: due.length, sent, failed });
}

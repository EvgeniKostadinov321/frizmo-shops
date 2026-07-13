import { clientIp } from "@/actions/cart";
import { confirmEpayPayment } from "@/actions/payment-confirm";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ePay нотификация (сървър-към-сървър). Публичен endpoint, защитен от CHECKSUM
 * проверката (само валиден подпис със secret-а на магазина минава). Rate-limit
 * срещу флууд. Отговаряме точния ePay формат „INVOICE=<N>:STATUS=OK".
 */
export async function POST(req: Request) {
  const ip = await clientIp();
  if (!(await checkRateLimit(`epay-notify:${ip}`, 60, 60))) {
    return new Response("Too Many Requests", { status: 429 });
  }

  const form = await req.formData();
  const encoded = String(form.get("encoded") ?? "");
  const checksum = String(form.get("checksum") ?? "");
  if (!encoded || !checksum) {
    return new Response("ERR", { status: 400 });
  }

  try {
    const { invoice, result } = await confirmEpayPayment({ encoded, checksum });
    /* ePay иска „INVOICE=N:STATUS=OK" за да не ретрайва. При invalid връщаме ERR
       (ePay ще опита пак — но валиден подпис никога няма да мине с грешен secret). */
    if (result === "ok" || result === "ignored") {
      return new Response(`INVOICE=${invoice}:STATUS=OK`, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response(`INVOICE=${invoice}:STATUS=ERR`, { status: 200 });
  } catch (err) {
    console.error(JSON.stringify({ scope: "epay-notify", error: String(err) }));
    return new Response("ERR", { status: 500 });
  }
}

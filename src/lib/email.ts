import "server-only";
import { Resend } from "resend";
import type { Shop } from "@/db";
import { formatPrice } from "@/lib/money";
import type { PricedLine } from "@/lib/pricing";

/**
 * Имейли при нова поръчка. Домейнът frizmo.bg е верифициран в Resend
 * (споделен акаунт с Frizmo). Липсващ ключ не чупи поръчки — само логва.
 */
const FROM = "Frizmo Shops <shops@frizmo.bg>";

interface OrderEmailData {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  note: string;
  shippingName: string;
  shippingPriceCents: number;
  paymentName: string;
  paymentDetails: string;
  totalCents: number;
  lines: PricedLine[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function linesTable(lines: PricedLine[], shipping: { name: string; cents: number }): string {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 12px 6px 0;">${esc(l.productName)}${l.variantLabel ? ` <span style="color:#6b7280">(${esc(l.variantLabel)})</span>` : ""}${l.appliedDeal ? ` <span style="color:#b45309">· ${esc(l.appliedDeal)}</span>` : ""}</td>
        <td style="padding:6px 12px;text-align:center;">×${l.qty}</td>
        <td style="padding:6px 0;text-align:right;">${formatPrice(l.lineTotalCents)}</td>
      </tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${rows}
    <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Доставка (${esc(shipping.name)})</td><td></td><td style="text-align:right;">${formatPrice(shipping.cents)}</td></tr>
  </table>`;
}

function shell(title: string, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1c1c;">
    <h1 style="font-size:20px;">${esc(title)}</h1>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#9ca3af;">Изпратено чрез Frizmo Shops</p>
  </div>`;
}

export async function sendOrderEmails(shop: Shop, order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — имейлите за поръчка са пропуснати.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const number = `#${String(order.orderNumber).padStart(4, "0")}`;
  const table = linesTable(order.lines, {
    name: order.shippingName,
    cents: order.shippingPriceCents,
  });
  const totalRow = `<p style="font-size:16px;font-weight:bold;">Общо: ${formatPrice(order.totalCents)}</p>`;

  const sends: Promise<unknown>[] = [];

  /* До търговеца */
  if (shop.email) {
    sends.push(
      resend.emails.send({
        from: FROM,
        to: shop.email,
        subject: `Нова поръчка ${number} — ${formatPrice(order.totalCents)}`,
        html: shell(
          `Нова поръчка ${number}`,
          `${table}${totalRow}
          <h2 style="font-size:16px;">Клиент</h2>
          <p style="font-size:14px;line-height:1.6;">
            ${esc(order.customerName)}<br/>
            ${esc(order.customerPhone)}${order.customerEmail ? `<br/>${esc(order.customerEmail)}` : ""}<br/>
            ${esc([order.address, order.city].filter(Boolean).join(", "))}<br/>
            Плащане: ${esc(order.paymentName)}
            ${order.note ? `<br/>Бележка: ${esc(order.note)}` : ""}
          </p>
          <p><a href="https://frizmo-shops.vercel.app/dashboard/orders">Виж в панела →</a></p>`,
        ),
      }),
    );
  }

  /* До купувача (ако е дал имейл) */
  if (order.customerEmail) {
    sends.push(
      resend.emails.send({
        from: FROM,
        to: order.customerEmail,
        subject: `Поръчката ти при ${shop.name} е приета (${number})`,
        html: shell(
          `Благодарим ти, ${order.customerName}!`,
          `<p style="font-size:14px;">Поръчка ${number} при <strong>${esc(shop.name)}</strong> е приета. Търговецът ще се свърже с теб при нужда.</p>
          ${table}${totalRow}
          <p style="font-size:14px;">Плащане: ${esc(order.paymentName)}${order.paymentDetails ? ` — ${esc(order.paymentDetails)}` : ""}</p>
          <p style="font-size:14px;">Въпроси: ${esc(shop.phone ?? shop.email ?? "")}</p>`,
        ),
      }),
    );
  }

  const results = await Promise.allSettled(sends);
  for (const r of results) {
    if (r.status === "rejected") console.error("Имейл за поръчка се провали:", r.reason);
  }
}

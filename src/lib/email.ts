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

/** Базов публичен URL — за линкове в имейлите (потвърждение, отписване).
 *  Dev fallback към localhost, за да работят линковете при локално тестване. */
const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://frizmo-shops.vercel.app");

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
  /** N9: подаръчна опаковка + картичка (търговецът трябва да ги види в имейла). */
  giftWrap?: boolean;
  giftCard?: boolean;
  giftNote?: string;
  giftWrapFeeCents?: number;
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
  const giftWrapRow = order.giftWrap
    ? `<p style="font-size:14px;color:#b45309;font-weight:600;">Подаръчна опаковка${(order.giftWrapFeeCents ?? 0) > 0 ? ` (+${formatPrice(order.giftWrapFeeCents!)})` : ""}</p>`
    : "";
  const giftCardRow = order.giftCard
    ? `<p style="font-size:14px;color:#b45309;font-weight:600;">Подаръчна картичка${order.giftNote ? `: „${esc(order.giftNote)}“` : ""}</p>`
    : "";
  const totalRow = `${giftWrapRow}${giftCardRow}<p style="font-size:16px;font-weight:bold;">Общо: ${formatPrice(order.totalCents)}</p>`;

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

/** Текст по статус за имейла до купувача при смяна на статус. */
export type StatusEmailKey =
  | "confirmed"
  | "shipped"
  | "cancelled"
  | "returned"
  | "return_rejected";

const STATUS_EMAIL: Record<
  StatusEmailKey,
  { subject: (n: string, shop: string) => string; title: string; body: string }
> = {
  confirmed: {
    subject: (n, shop) => `Поръчка ${n} е потвърдена — ${shop}`,
    title: "Поръчката ти е потвърдена",
    body: "прие поръчката ти и я подготвя.",
  },
  shipped: {
    subject: (n, shop) => `Поръчка ${n} е изпратена — ${shop}`,
    title: "Поръчката ти е изпратена",
    body: "изпрати поръчката ти — вече пътува към теб.",
  },
  cancelled: {
    subject: (n, shop) => `Поръчка ${n} е отказана — ${shop}`,
    title: "Поръчката ти е отказана",
    body: "отказа поръчката ти.",
  },
  /* N12 */
  returned: {
    subject: (n, shop) => `Връщането по поръчка ${n} е прието — ${shop}`,
    title: "Връщането е прието",
    body: "прие заявката ти за връщане.",
  },
  return_rejected: {
    subject: (n, shop) => `Заявката за връщане по поръчка ${n} — ${shop}`,
    title: "Заявката за връщане не е приета",
    body: "прегледа заявката ти за връщане и не я прие — поръчката остава завършена.",
  },
};

/**
 * Имейл до купувача при смяна на статус (confirmed/shipped/cancelled). Прост
 * статус + бутон към страницата на поръчката. Тихо се пропуска без имейл на
 * купувача или без RESEND ключ — имейлът е странична дейност и не бива да чупи
 * смяната на статус.
 */
export async function sendOrderStatusEmail(input: {
  shop: Pick<Shop, "name" | "slug" | "phone" | "email">;
  order: {
    id: string;
    orderNumber: number;
    publicToken: string;
    customerName: string;
    customerEmail: string;
  };
  status: StatusEmailKey;
}): Promise<void> {
  if (!input.order.customerEmail) return;
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — имейлът за статус е пропуснат.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const number = `#${String(input.order.orderNumber).padStart(4, "0")}`;
  const meta = STATUS_EMAIL[input.status];
  const orderUrl = `${BASE_URL}/s/${input.shop.slug}/order/${input.order.id}?t=${input.order.publicToken}`;
  const contact = input.shop.phone || input.shop.email || "";

  try {
    await resend.emails.send({
      from: FROM,
      to: input.order.customerEmail,
      subject: meta.subject(number, input.shop.name),
      html: shell(
        meta.title,
        `<p style="font-size:14px;line-height:1.6;">
          Здравей, ${esc(input.order.customerName)} — <strong>${esc(input.shop.name)}</strong> ${meta.body}
          Поръчка <strong>${number}</strong>.
        </p>
        ${
          (input.status === "cancelled" || input.status === "return_rejected") && contact
            ? `<p style="font-size:14px;">При въпроси: ${esc(contact)}</p>`
            : ""
        }
        <p style="margin:24px 0;">
          <a href="${orderUrl}" style="display:inline-block;background:#1c1c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Виж поръчката</a>
        </p>`,
      ),
    });
  } catch (e) {
    console.error("Имейл за статус на поръчка се провали:", e);
  }
}

/** N12: заявено връщане → имейл до търговеца (причината + линк към панела). */
export async function sendReturnRequestEmail(input: {
  shop: Pick<Shop, "name" | "email">;
  orderNumber: number;
  customerName: string;
  reason: string;
}): Promise<void> {
  if (!input.shop.email) return;
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — имейлът за връщане е пропуснат.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const number = `#${String(input.orderNumber).padStart(4, "0")}`;
  try {
    await resend.emails.send({
      from: FROM,
      to: input.shop.email,
      subject: `Заявено връщане за поръчка ${number}`,
      html: shell(
        `Заявено връщане — ${number}`,
        `<p style="font-size:14px;line-height:1.6;">
          ${esc(input.customerName)} заяви връщане по поръчка <strong>${number}</strong>.
          ${input.reason ? `<br/>Причина: „${esc(input.reason)}“` : ""}
        </p>
        <p style="font-size:14px;">Приеми или откажи връщането от панела — при приемане наличностите се възстановяват автоматично.</p>
        <p style="margin:24px 0;">
          <a href="${BASE_URL}/dashboard/orders" style="display:inline-block;background:#1c1c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Виж в панела</a>
        </p>`,
      ),
    });
  } catch (e) {
    console.error("Имейлът за заявено връщане се провали:", e);
  }
}

/**
 * Потвърждаващ имейл за нюзлетър абонамент (double opt-in). Липсващ ключ →
 * логва warning (абонатът остава pending, потвърждава се при следващ опит).
 */
export async function sendNewsletterConfirmEmail(input: {
  toEmail: string;
  shopName: string;
  shopSlug: string;
  token: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — потвърждаващият имейл е пропуснат.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const confirmUrl = `${BASE_URL}/s/${input.shopSlug}/newsletter/confirm?token=${input.token}`;
  try {
    await resend.emails.send({
      from: FROM,
      to: input.toEmail,
      subject: `Потвърди абонамента си за ${input.shopName}`,
      html: shell(
        `Потвърди абонамента си`,
        `<p style="font-size:14px;line-height:1.6;">Заяви абонамент за новини от <strong>${esc(input.shopName)}</strong>. Потвърди с бутона отдолу:</p>
        <p style="margin:24px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background:#1c1c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Потвърди абонамента</a>
        </p>
        <p style="font-size:12px;color:#9ca3af;">Ако не си заявявал абонамент, просто игнорирай този имейл.</p>`,
      ),
    });
  } catch (e) {
    console.error("Потвърждаващ нюзлетър имейл се провали:", e);
  }
}

/**
 * S4: newsletter кампания до потвърден абонат. Обикновен текст → параграфи;
 * ЗАДЪЛЖИТЕЛЕН „Отпиши се" линк (token механизмът на абонамента).
 * Връща true при успешно изпращане (за реалния recipientCount).
 */
export async function sendCampaignEmail(input: {
  toEmail: string;
  shopName: string;
  shopSlug: string;
  subject: string;
  body: string;
  unsubscribeToken: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — кампанийният имейл е пропуснат.");
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const unsubscribeUrl = `${BASE_URL}/s/${input.shopSlug}/newsletter/confirm?token=${input.unsubscribeToken}&action=unsubscribe`;
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="font-size:14px;line-height:1.6;white-space:pre-line;">${esc(p)}</p>`,
    )
    .join("");
  try {
    await resend.emails.send({
      from: FROM,
      to: input.toEmail,
      subject: input.subject,
      html: shell(
        input.shopName,
        `${paragraphs}
        <p style="margin-top:28px;font-size:12px;color:#9ca3af;">Получаваш този имейл като абонат на ${esc(input.shopName)}. <a href="${unsubscribeUrl}" style="color:#9ca3af;">Отпиши се</a></p>`,
      ),
    });
    return true;
  } catch (e) {
    console.error("Кампаниен имейл се провали:", e);
    return false;
  }
}

/**
 * S14: „{Продукт} отново е в наличност" — до чакащ купувач (back-in-stock).
 */
export async function sendBackInStockEmail(input: {
  toEmail: string;
  shopName: string;
  shopSlug: string;
  productName: string;
  productSlug: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — back-in-stock имейлът е пропуснат.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const productUrl = `${BASE_URL}/s/${input.shopSlug}/p/${input.productSlug}`;
  try {
    await resend.emails.send({
      from: FROM,
      to: input.toEmail,
      subject: `${input.productName} отново е в наличност — ${input.shopName}`,
      html: shell(
        "Отново е в наличност",
        `<p style="font-size:14px;line-height:1.6;"><strong>${esc(input.productName)}</strong> в <strong>${esc(input.shopName)}</strong> отново е наличен. Количествата може да са ограничени.</p>
        <p style="margin:24px 0;">
          <a href="${productUrl}" style="display:inline-block;background:#1c1c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Виж продукта</a>
        </p>
        <p style="font-size:12px;color:#9ca3af;">Получаваш този имейл, защото поиска известие при наличност. Няма да получиш втори за същия продукт.</p>`,
      ),
    });
  } catch (e) {
    console.error("Back-in-stock имейлът се провали:", e);
  }
}

/**
 * Съобщение от контактната форма на магазина → имейл до търговеца.
 * reply-to = имейла на клиента, за да отговори директно от пощата си.
 * Връща false при липсващ ключ / грешка (извикващият показва обща грешка).
 */
export async function sendContactEmail(input: {
  toShopEmail: string;
  shopName: string;
  fromName: string;
  fromEmail: string;
  message: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY липсва — контактното съобщение е пропуснато.");
    return false;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: FROM,
      to: input.toShopEmail,
      replyTo: input.fromEmail,
      subject: `Ново съобщение от сайта — ${input.fromName}`,
      html: shell(
        "Ново съобщение от сайта",
        `<p style="font-size:14px;line-height:1.6;">
          <strong>От:</strong> ${esc(input.fromName)} &lt;${esc(input.fromEmail)}&gt;<br/>
          <strong>Магазин:</strong> ${esc(input.shopName)}
        </p>
        <div style="margin-top:16px;padding:16px;background:#f5f5f4;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(input.message)}</div>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">Отговори направо на този имейл, за да пишеш на клиента.</p>`,
      ),
    });
    return true;
  } catch (e) {
    console.error("Контактно съобщение се провали:", e);
    return false;
  }
}

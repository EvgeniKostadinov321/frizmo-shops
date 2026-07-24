import "server-only";

/**
 * inv.bg API клиент — издава официална българска фактура за месечната транзакционна
 * такса (търговец → нас). Референтна имплементация: Frizmo (Saas monorepo), адаптирана.
 *
 * Валута: таксата е в EUR евроценти, но inv.bg изисква и BGN (курс 1.95583, `main_currency`).
 * ДДС: 0% с правно основание чл.113 ал.9 ЗДДС (фирмата не е регистрирана по ДДС).
 * Издателят (нашата фирма) идва автоматично от акаунта на API токена.
 *
 * ⚠️ Реалните inv.bg фактури са НАП записи от една номерационна серия — извиквай САМО
 * от production (виж prod-only гарда на мястото на извикване).
 */

const BASE = "https://api.inv.bg/v3";
const TOKEN = process.env.INV_BG_TOKEN;

/** Фиксиран курс EUR→BGN (валутен борд). */
const EUR_TO_BGN = 1.95583;
/** Правно основание за 0% ДДС (нерегистрирана по ДДС фирма). */
const NO_VAT_REASON = "чл.113 ал.9 от ЗДДС";

export interface InvBgResult {
  /** inv.bg вътрешен id (пази се за анулиране/препратка). */
  id: number;
  /** 10-цифрен номер на фактурата, напр. "0000000001". */
  number: string;
  /** Публичен shareable PDF линк (валиден 30 дни). */
  pdfLink: string;
}

/** Данъчни данни на получателя (търговеца) — snapshot от момента на издаване. */
export interface InvBgBilling {
  clientType: "company" | "individual";
  companyName: string;
  eik: string | null;
  mol: string | null;
  vatNumber: string | null;
  egn: string | null;
  address: string;
  city: string;
}

/** Данни за самата такса, която фактурираме. */
export interface InvBgInvoiceData {
  /** Дължима сума в евроценти (>0). */
  amountDueCents: number;
  /** Фактуриран период (за описанието на реда), напр. "2026-06". */
  periodLabel: string;
  /** Кога е платена таксата (дата на документа). */
  paidAt: Date;
}

async function invFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!TOKEN) throw new Error("INV_BG_TOKEN не е конфигуриран");

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "Accept-Language": "bg",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    const msg =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `HTTP ${res.status}`;
    throw new Error(`inv.bg API грешка: ${msg}`);
  }

  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/** Закръгля до 2 знака (стотинки/центове) без float грешки. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Сглобява payload-а за POST /invoices — чиста функция (без мрежа), за да е тестваема.
 * Виж createInvBgInvoice за реалното извикване.
 */
export function buildInvoicePayload(
  billing: InvBgBilling,
  invoice: InvBgInvoiceData,
): Record<string, unknown> {
  const isIndividual = billing.clientType === "individual";
  const amountEur = round2(invoice.amountDueCents / 100);
  const amountBgn = round2(amountEur * EUR_TO_BGN);

  const payload: Record<string, unknown> = {
    type: "dan", // данъчна фактура
    is_to_person: isIndividual,
    to_name: billing.companyName || "Клиент",
    to_address: [billing.address, billing.city].filter(Boolean).join(", ") || "България",
    to_country: "BG",
    to_is_reg_vat: Boolean(billing.vatNumber),
    date_create: invoice.paidAt.toISOString(),
    date_event: invoice.paidAt.toISOString(),
    payment_method: "card",
    status: "paid",
    payment_currency: "EUR",
    currency_rate: EUR_TO_BGN,
    payment_amount: amountEur,
    payment_amount_base: amountEur,
    payment_amount_vat: 0,
    payment_amount_reduction: 0,
    payment_amount_total: amountEur,
    // inv.bg изисква сумата и в BGN, когато плащането е в друга валута.
    main_currency: {
      payment_amount: amountBgn,
      payment_amount_base: amountBgn,
      payment_amount_vat: 0,
      payment_amount_reduction: 0,
      payment_amount_total: amountBgn,
    },
    vat: { percent: 0, reason_without: NO_VAT_REASON },
    items: [
      {
        name: `Такса за продажби (Frizmo Shops) — ${invoice.periodLabel}`,
        quantity: 1,
        quantity_unit: "бр.",
        price: amountEur,
        price_total: amountEur,
        vat_percent: 0,
      },
    ],
  };

  if (isIndividual) {
    payload.to_egn = billing.egn ?? "";
    payload.to_bulstat = "";
    payload.to_mol = "";
    payload.to_vat_number = "";
  } else {
    payload.to_bulstat = billing.eik ?? "";
    payload.to_mol = billing.mol || billing.companyName || "";
    payload.to_vat_number = billing.vatNumber ?? "";
    payload.to_egn = "";
  }

  return payload;
}

/**
 * Създава inv.bg фактура за таксата + връща shareable PDF линк.
 * Хвърля при грешка — обвий с `createInvBgInvoiceWithRetry` за устойчивост.
 */
export async function createInvBgInvoice(
  billing: InvBgBilling,
  invoice: InvBgInvoiceData,
): Promise<InvBgResult> {
  const payload = buildInvoicePayload(billing, invoice);

  const created = await invFetch<{ id: number; number: string }>("/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // Публичен PDF линк (валиден 30 дни) — за dashboard бутона.
  const validUntil = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const share = await invFetch<{ success: boolean; link: string }>("/links/share", {
    method: "POST",
    body: JSON.stringify({
      items: [{ type: "invoices", ids: [created.id], language: "BG" }],
      valid_until: validUntil,
    }),
  });

  return { id: created.id, number: created.number, pdfLink: share.link };
}

/**
 * Създаване с 3 опита (exponential backoff). Връща null при окончателен провал —
 * извикващият логва и маркира `failed`, за да се пробва пак от retry job.
 */
export async function createInvBgInvoiceWithRetry(
  billing: InvBgBilling,
  invoice: InvBgInvoiceData,
  attempts = 3,
): Promise<InvBgResult | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await createInvBgInvoice(billing, invoice);
    } catch (err) {
      const isLast = i === attempts - 1;
      console.error(
        JSON.stringify({
          scope: "invbg",
          attempt: i + 1,
          attempts,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      if (!isLast) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  return null;
}

/** Анулира фактура (за корекции) — inv.bg пази анулирания запис в НАП. */
export async function annulInvBgInvoice(invBgId: number): Promise<void> {
  await invFetch<null>(`/invoices/${invBgId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_annulled: 1 }),
  });
}

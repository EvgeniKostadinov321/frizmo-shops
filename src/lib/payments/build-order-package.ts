import { getPaymentProvider, type PaymentCreds, type PaymentPackage } from "@/lib/payments";

export const EPAY_EXP_SECONDS = 7200; // 2 часа за плащане, после cron auto-cancel

/** Строи ePay пакета за поръчка (чиста — само подпис върху creds на магазина). */
export function buildEpayForOrder(args: {
  slug: string;
  orderId: string;
  orderNumber: number;
  totalCents: number;
  shopName: string;
  creds: PaymentCreds;
  siteUrl: string;
  apiBase: string;
  /** Публичният token на поръчката — URL_OK го носи, иначе confirmation-ът е 404. */
  token: string;
}): PaymentPackage {
  const base = args.siteUrl.replace(/\/$/, "");
  return getPaymentProvider("epay").buildPackage(
    {
      invoice: String(args.orderNumber),
      amountCents: args.totalCents,
      description: `Поръчка №${args.orderNumber} от ${args.shopName}`,
      expSeconds: EPAY_EXP_SECONDS,
      /* ?t=<token> е ЗАДЪЛЖИТЕЛЕН — order confirmation страницата отхвърля достъп
         без валиден token (IDOR защита), иначе успешно платена поръчка връща 404
         (одит 2026-07-13 S1-02). */
      urlOk: `${base}/s/${args.slug}/order/${args.orderId}?paid=1&t=${args.token}`,
      urlCancel: `${base}/s/${args.slug}/checkout?cancelled=1`,
    },
    args.creds,
    args.apiBase,
  );
}

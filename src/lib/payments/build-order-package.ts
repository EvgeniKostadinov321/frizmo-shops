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
}): PaymentPackage {
  const base = args.siteUrl.replace(/\/$/, "");
  return getPaymentProvider("epay").buildPackage(
    {
      invoice: String(args.orderNumber),
      amountCents: args.totalCents,
      description: `Поръчка №${args.orderNumber} от ${args.shopName}`,
      expSeconds: EPAY_EXP_SECONDS,
      urlOk: `${base}/s/${args.slug}/order/${args.orderId}?paid=1`,
      urlCancel: `${base}/s/${args.slug}/checkout?cancelled=1`,
    },
    args.creds,
    args.apiBase,
  );
}

export type PaymentId = "epay";

/** Ключове от shop_payment_accounts.credentials (jsonb). */
export type PaymentCreds = { kin: string; secret: string };

/** Готов ePay пакет за auto-submit форма от клиента. */
export interface PaymentPackage {
  actionUrl: string;
  fields: Record<string, string>;
}

export interface BuildPackageInput {
  /** ePay INVOICE — поредният номер на поръчката (per-shop уникален). */
  invoice: string;
  amountCents: number;
  description: string;
  /** Валидност на плащането в секунди (EXP_TIME). */
  expSeconds: number;
  urlOk: string;
  urlCancel: string;
}

export interface PaymentNotification {
  invoice: string;
  status: "paid" | "denied" | "expired" | "unknown";
  amountCents: number | null;
  raw: Record<string, string>;
}

export interface PaymentProvider {
  id: PaymentId;
  /** Строи подписан redirect пакет със secret-а на магазина. */
  buildPackage(input: BuildPackageInput, creds: PaymentCreds, apiBase: string): PaymentPackage;
  /** Валидира подписа на нотификацията; null = невалиден (не се доверяваме). */
  parseNotification(
    body: { encoded: string; checksum: string },
    creds: PaymentCreds,
  ): PaymentNotification | null;
}

/** Платежна грешка — общо BG съобщение навън, детайл в лог. */
export class PaymentError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

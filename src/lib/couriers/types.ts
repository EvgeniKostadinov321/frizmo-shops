export type CourierId = "econt" | "speedy";

/** Ключове от shop_courier_accounts.credentials (jsonb). Формата варира по куриер. */
export type CourierCreds = Record<string, string>;

export interface Office {
  officeId: string;
  name: string;
  city: string;
  address: string;
  type: "office" | "apt";
}

export interface WaybillInput {
  receiverName: string;
  receiverPhone: string;
  /** Дестинация: офис ID (office delivery) ИЛИ свободен адрес + град (address delivery). */
  officeId: string | null;
  address: string;
  city: string;
  sender: { name: string; phone: string; city: string; address: string };
  weightGrams: number;
  /** COD сума в центове (null = без наложен платеж). */
  codCents: number | null;
  /** Кратко описание на съдържанието (за товарителницата). */
  contents: string;
}

export interface WaybillResult {
  waybillId: string;
  trackingNumber: string;
  /** PDF етикет — base64 или URL (според куриера). */
  labelPdf: string;
}

/** Куриерска грешка — общо BG съобщение навън, детайл в лог. */
export class CourierError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "CourierError";
  }
}

export interface CourierProvider {
  id: CourierId;
  searchOffices(city: string, creds: CourierCreds): Promise<Office[]>;
  createWaybill(input: WaybillInput, creds: CourierCreds): Promise<WaybillResult>;
  trackingUrl(trackingNumber: string): string;
}

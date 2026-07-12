import type {
  CourierCreds,
  CourierProvider,
  Office,
  WaybillInput,
  WaybillResult,
} from "./types";
import { CourierError } from "./types";

/* Econt Delivery API (JSON). Auth: HTTP Basic (username/password) в credentials.
   Base URL от ECONT_API_BASE (demo за разработка), иначе production.
   Сверено на живо срещу demo.econt.com 2026-07-13: офис = { code, name, isAPS,
   address: { city: { name }, fullAddress } }. */
const ECONT_BASE = process.env.ECONT_API_BASE ?? "https://ee.econt.com/services";

async function econtPost<T>(path: string, creds: CourierCreds, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ECONT_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new CourierError("Куриерската услуга не отговори.", err);
  }
  if (!res.ok) {
    throw new CourierError("Куриерската услуга не отговори.", { status: res.status });
  }
  return (await res.json()) as T;
}

export const econt: CourierProvider = {
  id: "econt",

  async searchOffices(city, creds) {
    /* Nomenclatures.getOffices връща всички офиси; филтрираме по address.city.name. */
    const data = await econtPost<{ offices?: EcontOffice[] }>(
      "/Nomenclatures/NomenclaturesService.getOffices.json",
      creds,
      { countryCode: "BGR" },
    );
    const target = city.trim().toLowerCase();
    return (data.offices ?? [])
      .filter((o) => (o.address?.city?.name ?? "").toLowerCase().includes(target))
      .map(
        (o): Office => ({
          officeId: o.code,
          name: o.name,
          city: o.address?.city?.name ?? "",
          address: o.address?.fullAddress?.trim() ?? "",
          type: o.isAPS ? "apt" : "office",
        }),
      );
  },

  async createWaybill(input, creds) {
    /* Shipments.createLabel. Тегло в kg; COD → services.cdAmount (get); офис по код
       ИЛИ свободен адрес. Точните полета — Econt Delivery docs. */
    const data = await econtPost<EcontLabelResult>(
      "/Shipments/LabelService.createLabel.json",
      creds,
      {
        label: {
          senderClient: { name: input.sender.name, phones: [input.sender.phone] },
          senderAddress: {
            city: { name: input.sender.city },
            street: input.sender.address,
          },
          receiverClient: { name: input.receiverName, phones: [input.receiverPhone] },
          receiverOfficeCode: input.officeId ?? undefined,
          receiverAddress: input.officeId
            ? undefined
            : { city: { name: input.city }, street: input.address },
          packCount: 1,
          weight: input.weightGrams / 1000,
          shipmentDescription: input.contents,
          services:
            input.codCents != null
              ? { cdAmount: input.codCents / 100, cdType: "get" }
              : undefined,
        },
      },
    );
    const shipmentNumber = String(data.label?.shipmentNumber ?? "");
    return {
      waybillId: shipmentNumber,
      trackingNumber: shipmentNumber,
      labelPdf: data.label?.pdfURL ?? "",
    };
  },

  trackingUrl(trackingNumber) {
    return `https://www.econt.com/services/track-shipment/${trackingNumber}`;
  },
};

interface EcontOffice {
  code: string;
  name: string;
  isAPS?: boolean;
  address?: { city?: { name?: string }; fullAddress?: string };
}
interface EcontLabelResult {
  label?: { shipmentNumber?: string | number; pdfURL?: string };
}

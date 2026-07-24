import type { CourierCreds, CourierProvider, Office } from "./types";
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

  async calculatePrice(input, creds) {
    /* Същата createLabel заявка, но mode:"calculate" → връща цена без да създава
       пратка (Econt: validate/calculate/create). Цената е в EUR (еврозона от 01.2026).
       ⚠️ Полето `label.totalPrice` се СВЕРЯВА на живо (T9); коригирай ако е различно.
       null при всяка грешка → викащият пада на резервната цена. */
    try {
      const data = await econtPost<{ label?: { totalPrice?: number } }>(
        "/Shipments/LabelService.createLabel.json",
        creds,
        {
          mode: "calculate",
          label: {
            /* shipmentType е ЗАДЪЛЖИТЕЛЕН в calculate mode (сверено на живо: без него
               HTTP 517 „Некоректен тип пратка"). "PACK" = стандартна пратка. */
            shipmentType: "PACK",
            senderClient: { name: "-", phones: ["0000000000"] },
            senderAddress: { city: { name: "София" }, street: "-" },
            receiverClient: { name: "-", phones: ["0000000000"] },
            receiverOfficeCode: input.officeId ?? undefined,
            receiverAddress: input.officeId
              ? undefined
              : { city: { name: input.city }, street: "-" },
            packCount: 1,
            weight: input.weightGrams / 1000,
            services:
              input.codCents != null
                ? { cdAmount: input.codCents / 100, cdType: "get" }
                : undefined,
          },
        },
      );
      const total = data.label?.totalPrice;
      if (typeof total !== "number") return null;
      return { amountCents: Math.round(total * 100) };
    } catch {
      return null;
    }
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

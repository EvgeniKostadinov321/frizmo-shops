import type {
  CourierCreds,
  CourierProvider,
  Office,
  WaybillInput,
  WaybillResult,
} from "./types";
import { CourierError } from "./types";

/* Speedy REST API. Auth: userName/password в тялото на всяка заявка.
   Base URL от SPEEDY_API_BASE (за demo/prod override), иначе production v1.
   ⚠️ Точните полета (office структура, shipment payload) се сверяват на живо при
   пристигане на ключовете (api.registration@speedy.bg) — виж бележките по-долу. */
const SPEEDY_BASE = process.env.SPEEDY_API_BASE ?? "https://api.speedy.bg/v1";

async function speedyPost<T>(path: string, creds: CourierCreds, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SPEEDY_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName: creds.username, password: creds.password, ...body }),
    });
  } catch (err) {
    throw new CourierError("Куриерската услуга не отговори.", err);
  }
  if (!res.ok) {
    throw new CourierError("Куриерската услуга не отговори.", { status: res.status });
  }
  return (await res.json()) as T;
}

export const speedy: CourierProvider = {
  id: "speedy",

  async searchOffices(city, creds) {
    /* POST /location/office — офиси по име на населено място (siteName). */
    const data = await speedyPost<{ offices?: SpeedyOffice[] }>("/location/office", creds, {
      countryId: 100, // BG — сверявай с docs при живо тестване
      name: city.trim(),
    });
    return (data.offices ?? []).map(
      (o): Office => ({
        officeId: String(o.id),
        name: o.name,
        city: o.address?.siteName ?? "",
        address: o.address?.fullAddressString ?? "",
        type: "office",
      }),
    );
  },

  async createWaybill(input, creds) {
    /* POST /shipment — товарителница. Отговорът дава `id`; PDF етикетът се взима с
       ОТДЕЛНА заявка към /print (format: pdf) — сверява се на живо при ключовете.
       COD → additionalServices.cod; тегло kg. */
    const data = await speedyPost<SpeedyShipmentResult>("/shipment", creds, {
      recipient: {
        clientName: input.receiverName,
        phone1: { number: input.receiverPhone },
        pickupOfficeId: input.officeId ? Number(input.officeId) : undefined,
        addressLocation: input.officeId
          ? undefined
          : { siteName: input.city, addressLine1: input.address },
      },
      service: {
        serviceId: 505, // стандартна услуга — сверявай с docs
        additionalServices:
          input.codCents != null
            ? { cod: { amount: input.codCents / 100, processingType: "CASH" } }
            : undefined,
      },
      content: {
        parcelsCount: 1,
        totalWeight: input.weightGrams / 1000,
        contents: input.contents,
        package: "BOX",
      },
    });
    const id = String(data.id ?? "");
    return { waybillId: id, trackingNumber: id, labelPdf: data.pdfURL ?? "" };
  },

  trackingUrl(trackingNumber) {
    return `https://www.speedy.bg/bg/track-shipment?shipmentNumber=${trackingNumber}`;
  },
};

interface SpeedyOffice {
  id: number;
  name: string;
  address?: { siteName?: string; fullAddressString?: string };
}
interface SpeedyShipmentResult {
  id?: string | number;
  pdfURL?: string;
}

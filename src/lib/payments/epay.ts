import {
  decodeData,
  encodeData,
  hmacSha1,
  mapEpayStatus,
  toEpayAmount,
  verifyChecksum,
} from "./epay-signature";
import type { BuildPackageInput, PaymentCreds, PaymentPackage, PaymentProvider } from "./types";

/** Строи ePay paylogin пакета: ENCODED(данни) + CHECKSUM(secret). */
function buildPackage(
  input: BuildPackageInput,
  creds: PaymentCreds,
  apiBase: string,
): PaymentPackage {
  /* EXP_TIME е абсолютен unix timestamp в секунди (сега + expSeconds). Смята се
     при извикването (не в тест — тук е ОК, извиква се от createOrder на сървъра). */
  const expTime = Math.floor(Date.now() / 1000) + input.expSeconds;
  const encoded = encodeData({
    MIN: creds.kin,
    INVOICE: input.invoice,
    AMOUNT: toEpayAmount(input.amountCents),
    CURRENCY: "EUR",
    EXP_TIME: String(expTime),
    DESCR: input.description,
  });
  return {
    actionUrl: `${apiBase.replace(/\/$/, "")}/`,
    fields: {
      PAGE: "paylogin",
      ENCODED: encoded,
      CHECKSUM: hmacSha1(encoded, creds.secret),
      URL_OK: input.urlOk,
      URL_CANCEL: input.urlCancel,
    },
  };
}

/** Валидира подписа на нотификацията и вади INVOICE/STATUS/AMOUNT. */
function parseNotification(body: { encoded: string; checksum: string }, creds: PaymentCreds) {
  if (!body.encoded || !body.checksum) return null;
  if (!verifyChecksum(body.encoded, body.checksum, creds.secret)) return null;
  const raw = decodeData(body.encoded);
  const amount = raw.AMOUNT ? Math.round(Number(raw.AMOUNT) * 100) : null;
  return {
    invoice: raw.INVOICE ?? "",
    status: mapEpayStatus(raw.STATUS ?? ""),
    amountCents: amount !== null && Number.isFinite(amount) ? amount : null,
    raw,
  };
}

export const epay: PaymentProvider = { id: "epay", buildPackage, parseNotification };

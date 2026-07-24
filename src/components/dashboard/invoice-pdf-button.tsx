"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon, Spinner } from "@/components/ui";
import { getFreshInvoicePdfUrl } from "@/actions/billing-details";

/**
 * Бутон „Фактура" — генерира СВЕЖ PDF линк при клик (L3: замразеният линк умира
 * след 30 дни, а фактурите се пазят 10г). Отваря PDF-а в нов таб.
 */
export function InvoicePdfButton({
  feeInvoiceId,
  number,
}: {
  feeInvoiceId: string;
  number: string | null;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const res = await getFreshInvoicePdfUrl(feeInvoiceId);
    setBusy(false);
    if (res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(res.error ?? "Фактурата не е налична.");
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-60"
      title={number ? `Фактура № ${number}` : "Официална фактура"}
    >
      {busy ? <Spinner size="sm" /> : <Icon name="download" size={14} className="shrink-0" />}
      Фактура
    </button>
  );
}

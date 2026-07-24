"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { retryInvBgInvoice } from "@/actions/admin";

/** Админ бутон за ръчно преиздаване на провалена/пропусната inv.bg фактура (т.2). */
export function AdminInvoiceRetry({ feeInvoiceId }: { feeInvoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function retry() {
    setBusy(true);
    const res = await retryInvBgInvoice(feeInvoiceId);
    setBusy(false);
    if (res.ok) {
      toast.success("Фактурата е издадена.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Button size="sm" variant="secondary" loading={busy} onClick={retry}>
      Издай пак
    </Button>
  );
}

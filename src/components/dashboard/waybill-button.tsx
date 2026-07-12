"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateWaybill } from "@/actions/waybills";
import { Button, Card } from "@/components/ui";

interface Props {
  orderId: string;
  provider: "econt" | "speedy";
  waybillId: string | null;
  trackingNumber: string | null;
  /** Куриерски tracking URL (готов от сървъра — куриерът е единственият, който го знае). */
  trackingUrl: string | null;
}

/** Товарителница на поръчка: генерирай (веднъж) или покажи съществуваща + tracking. */
export function WaybillButton({ orderId, waybillId, trackingNumber, trackingUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const providerName = "куриера";

  if (waybillId) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-700">
          Товарителница №{trackingNumber ?? waybillId}
        </p>
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Проследи пратката
          </a>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-ink-700">Генерирай товарителница при {providerName}.</p>
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await generateWaybill(orderId);
            if (res.ok) {
              toast.success("Товарителницата е създадена.");
              router.refresh();
            } else {
              toast.error(res.error ?? "Товарителницата не може да се създаде сега.");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        Генерирай товарителница
      </Button>
    </Card>
  );
}

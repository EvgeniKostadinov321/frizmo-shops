"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteShippingZone, saveShippingZone } from "@/actions/fulfillment";
import { Button, Icon, Input, PriceInput } from "@/components/ui";
import type { ShippingZone } from "@/db";
import { formatPrice } from "@/lib/money";

/**
 * Д3: редактор на ценови зони под courier метод. Ако методът има ≥1 зона,
 * цената идва от зоната (клиентът избира на checkout); без зони → фиксирана цена.
 */
export function ShippingZonesEditor({
  methodId,
  zones,
}: {
  methodId: string;
  zones: ShippingZone[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await saveShippingZone({ shippingMethodId: methodId, name, price });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setName("");
      setPrice("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await deleteShippingZone({ id });
      if (!res.ok) toast.error(res.error);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-surface-100 pt-2">
      <p className="text-xs font-medium text-ink-500">
        {zones.length > 0
          ? "Зони — клиентът избира на поръчката, цената идва от зоната:"
          : "Зони (по избор) — при добавена зона клиентът избира град/регион на поръчката."}
      </p>

      {zones.map((z) => (
        <div key={z.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 truncate text-ink-900">{z.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="tabular-nums text-ink-700">{formatPrice(z.priceCents)}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Изтрий зона"
              disabled={busy}
              onClick={() => remove(z.id)}
            >
              <Icon name="trash" size={16} />
            </Button>
          </span>
        </div>
      ))}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Име на зона"
            hideLabel
            placeholder="Напр. София"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="w-28">
          <PriceInput
            label="Цена"
            hideLabel
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="sm" disabled={busy || !name || !price} onClick={add}>
          Добави
        </Button>
      </div>
    </div>
  );
}

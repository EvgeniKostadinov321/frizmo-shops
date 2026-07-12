"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteShippingZone, saveShippingZone } from "@/actions/fulfillment";
import { Button, Checkbox, Icon, Input, PriceInput } from "@/components/ui";
import type { ShippingZone } from "@/db";
import { formatPrice } from "@/lib/money";

/**
 * Д3.1: редактор на ценови зони под courier метод. Всяка зона има списък градове;
 * на checkout клиентът пише адрес → градът избира зоната автоматично (без picker).
 * „Останала страна“ е fallback при непокрит град.
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
  const [cities, setCities] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await saveShippingZone({
        shippingMethodId: methodId,
        name,
        price,
        cities,
        isFallback,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setName("");
      setPrice("");
      setCities("");
      setIsFallback(false);
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
          ? "Зони — клиентът пише адрес, градът избира зоната автоматично:"
          : "Зони (по избор) — задай градове; на поръчката цената се избира по града."}
      </p>

      {zones.map((z) => (
        <div key={z.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-medium text-ink-900">{z.name}</span>
            <span className="ml-2 text-xs text-ink-500">
              {z.isFallback ? "Останала страна" : z.cities || "— без градове"}
            </span>
          </span>
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

      <div className="flex flex-col gap-2 rounded-control border border-surface-200 p-2">
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
        </div>
        <Input
          label="Градове (със запетая)"
          hideLabel
          placeholder="напр. София, Перник"
          value={cities}
          onChange={(e) => setCities(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <Checkbox
            label="Останала страна (при непокрит град)"
            checked={isFallback}
            onChange={(e) => setIsFallback(e.target.checked)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !name || !price || (!cities.trim() && !isFallback)}
            onClick={add}
          >
            Добави
          </Button>
        </div>
      </div>
    </div>
  );
}

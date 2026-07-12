"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteShippingZone, saveShippingZone } from "@/actions/fulfillment";
import { Button, Icon, Input, PriceInput } from "@/components/ui";
import type { ShippingZone } from "@/db";
import { formatPrice } from "@/lib/money";

/**
 * Д3.1: цени на доставка по град. Търговецът добавя редове „град → цена"; клиентът
 * пише адрес на checkout → градът избира цената автоматично (без picker). Един ред
 * може да е „Всички останали градове" (fallback за непокрит град).
 */
export function ShippingZonesEditor({
  methodId,
  zones,
}: {
  methodId: string;
  zones: ShippingZone[];
}) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [fallbackPrice, setFallbackPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const cityZones = zones.filter((z) => !z.isFallback);
  const fallback = zones.find((z) => z.isFallback);

  async function addCity() {
    setBusy(true);
    try {
      const res = await saveShippingZone({
        shippingMethodId: methodId,
        name: city, // името на зоната = града (за snapshot „метод — град")
        price,
        cities: city,
        isFallback: false,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCity("");
      setPrice("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveFallback() {
    setBusy(true);
    try {
      /* Един fallback ред: ако вече има → трием стария, после създаваме нов с новата цена. */
      if (fallback) await deleteShippingZone({ id: fallback.id });
      const res = await saveShippingZone({
        shippingMethodId: methodId,
        name: "Останали градове",
        price: fallbackPrice,
        cities: "",
        isFallback: true,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFallbackPrice("");
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
    <div className="mt-2 flex flex-col gap-3 border-t border-surface-100 pt-3">
      <p className="text-xs font-medium text-ink-500">
        Цени по град — клиентът пише адрес, градът избира цената автоматично.
      </p>

      {/* Списък градове с цени */}
      {cityZones.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {cityZones.map((z) => (
            <div key={z.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{z.cities}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-ink-700">{formatPrice(z.priceCents)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Изтрий град"
                  disabled={busy}
                  onClick={() => remove(z.id)}
                >
                  <Icon name="trash" size={16} />
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Добавяне на град */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Град"
            hideLabel
            placeholder="Град (напр. София)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="w-28">
          <PriceInput label="Цена" hideLabel value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button variant="secondary" size="sm" disabled={busy || !city.trim() || !price} onClick={addCity}>
          Добави
        </Button>
      </div>

      {/* Всички останали градове (fallback) */}
      <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface-50 px-3 py-2">
        <span className="text-sm text-ink-700">Всички останали градове:</span>
        {fallback && (
          <span className="tabular-nums font-medium text-ink-900">
            {formatPrice(fallback.priceCents)}
          </span>
        )}
        <span className="ml-auto flex items-end gap-2">
          <div className="w-28">
            <PriceInput
              label="Цена за останалите"
              hideLabel
              placeholder={fallback ? "нова цена" : "0,00"}
              value={fallbackPrice}
              onChange={(e) => setFallbackPrice(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !fallbackPrice}
            onClick={saveFallback}
          >
            {fallback ? "Смени" : "Задай"}
          </Button>
        </span>
      </div>
    </div>
  );
}

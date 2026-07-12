"use client";

import { useEffect, useRef, useState } from "react";
import { searchOfficesForShop, type PublicOffice } from "@/actions/couriers";
import type { CourierId } from "@/lib/couriers";

interface Props {
  shopId: string;
  provider: CourierId;
  /** Избраният офис (за показване). */
  selected: { officeId: string; officeName: string } | null;
  onSelect: (office: { officeId: string; officeName: string } | null) => void;
}

/** Checkout офис търсачка (--sf-* токени). Пише град → офисите на куриера → избор.
    Graceful: грешка/липса → купувачът може пак да поръча (сървърът блокира без офис). */
export function CourierOfficePicker({ shopId, provider, selected, onSelect }: Props) {
  const [city, setCity] = useState("");
  const [offices, setOffices] = useState<PublicOffice[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const q = city.trim();
    if (q.length < 2) {
      /* setState синхронно в effect чупи react-compiler lint → queueMicrotask. */
      queueMicrotask(() => setOffices([]));
      return;
    }
    const id = ++reqId.current;
    queueMicrotask(() => setLoading(true));
    const timer = setTimeout(async () => {
      try {
        const result = await searchOfficesForShop(shopId, provider, q);
        if (id === reqId.current) {
          setOffices(result);
          setOpen(true);
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [city, shopId, provider]);

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-(--sf-text)">
        Офис на куриера<span className="text-(--sf-accent)"> *</span>
      </span>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-(--sf-radius) border border-(--sf-primary) bg-(--sf-bg) px-3.5 py-2.5">
          <span className="text-sm text-(--sf-text)">{selected.officeName}</span>
          <button
            type="button"
            className="text-sm text-(--sf-accent) underline"
            onClick={() => {
              onSelect(null);
              setCity("");
            }}
          >
            Смени
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className="w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text) outline-none focus:border-(--sf-primary)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onFocus={() => offices.length > 0 && setOpen(true)}
            placeholder="Град (напр. София)…"
            autoComplete="off"
          />
          {loading && (
            <span className="absolute right-3 top-3 text-xs text-(--sf-muted)">…</span>
          )}
          {open && offices.length > 0 && (
            <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) py-1 shadow-lg">
              {offices.map((o) => (
                <li key={o.officeId}>
                  <button
                    type="button"
                    className="w-full px-3.5 py-2.5 text-left text-sm text-(--sf-text) transition-colors hover:bg-(--sf-bg)"
                    onClick={() => {
                      onSelect({ officeId: o.officeId, officeName: `${o.name} · ${o.address}` });
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{o.name}</span>
                    {o.address && (
                      <span className="mt-0.5 block text-xs text-(--sf-muted)">{o.address}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && !loading && offices.length === 0 && city.trim().length >= 2 && (
            <p className="mt-1 text-xs text-(--sf-muted)">
              Няма намерени офиси за този град. Провери изписването.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

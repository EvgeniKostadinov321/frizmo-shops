"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveCity,
  useAddressSuggest,
  type AddressResult,
} from "@/lib/use-address-suggest";

/** Storefront адрес autocomplete (--sf-* токени). Graceful: без HERE ключ → обикновено поле. */
export function SfAddressAutocomplete({
  value,
  onChange,
  onSelect,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  className?: string;
}) {
  const { suggestions, loading, query, clear } = useAddressSuggest();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          query(e.target.value);
          setOpen(e.target.value.length >= 3);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Започни да пишеш адрес…"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-3 text-xs text-(--sf-muted)">…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) py-1 shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({
                    fullAddress: s.address?.label || s.title,
                    city: resolveCity(s),
                  });
                  clear();
                  setOpen(false);
                }}
                className="w-full px-3.5 py-2.5 text-left text-sm text-(--sf-text) transition-colors hover:bg-(--sf-bg)"
              >
                <span className="font-medium">{s.title}</span>
                {s.address?.label && s.address.label !== s.title && (
                  <span className="mt-0.5 block text-xs text-(--sf-muted)">{s.address.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

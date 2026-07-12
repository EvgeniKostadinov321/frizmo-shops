"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Spinner } from "@/components/ui";
import {
  resolveCity,
  useAddressSuggest,
  type AddressResult,
} from "@/lib/use-address-suggest";

export type { AddressResult };

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  error?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  error,
}: AddressAutocompleteProps) {
  const { suggestions, loading, query, clear } = useAddressSuggest();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(text: string) {
    onChange(text);
    query(text);
    setOpen(text.length >= 3);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        label="Адрес"
        name="address"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Започни да пишеш и избери от предложенията..."
        autoComplete="off"
        error={error}
      />
      {loading && (
        <span className="absolute right-3 top-9">
          <Spinner size="sm" />
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-card border border-surface-200 bg-surface-0 py-1 shadow-lg">
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
                className="w-full px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-surface-50"
              >
                <span className="font-medium text-ink-900">{s.title}</span>
                {s.address?.label && s.address.label !== s.title && (
                  <span className="mt-0.5 block text-xs text-ink-500">{s.address.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

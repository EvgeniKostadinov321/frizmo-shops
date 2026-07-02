"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Spinner } from "@/components/ui";

/*
 * HERE autosuggest — патърнът е портнат от Frizmo (AddressAutocomplete.tsx).
 * .trim() на ключа: env стойност с trailing newline се URL-кодира като %0A
 * и HERE отговаря с "Illegal API key id".
 */
const HERE_API_KEY = (process.env.NEXT_PUBLIC_HERE_API_KEY ?? "").trim();

interface AddressSuggestion {
  id: string;
  title: string;
  resultType: string;
  address?: {
    label?: string;
    city?: string;
    district?: string;
    county?: string;
  };
}

export interface AddressResult {
  fullAddress: string;
  city: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  error?: string;
}

function resolveCity(suggestion: AddressSuggestion): string {
  const addr = suggestion.address;
  const direct = addr?.city || addr?.district || addr?.county;
  if (direct) return direct;
  if (addr?.label) {
    /* HERE label: "ул. Х 25, 4004 Пловдив, България" — градът е в предпоследната част */
    const parts = addr.label.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const cityPart = parts[parts.length - 2]!.replace(/^\d+\s*/, "");
      if (cityPart) return cityPart;
    }
  }
  return "";
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  error,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  function handleInput(query: string) {
    onChange(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3 || !HERE_API_KEY) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          apiKey: HERE_API_KEY,
          at: "42.7339,25.4858",
          in: "countryCode:BGR",
          limit: "5",
          lang: "bg",
        });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(
          `https://autosuggest.search.hereapi.com/v1/autosuggest?${params}`,
          { signal: controller.signal },
        );
        clearTimeout(timer);
        const data = (await res.json()) as { items?: AddressSuggestion[] };
        const items = (data.items ?? []).filter((item) =>
          ["houseNumber", "street", "place"].includes(item.resultType),
        );
        setSuggestions(items);
        setOpen(items.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(suggestion: AddressSuggestion) {
    onSelect({
      fullAddress: suggestion.address?.label || suggestion.title,
      city: resolveCity(suggestion),
    });
    setOpen(false);
    setSuggestions([]);
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
                onClick={() => handleSelect(s)}
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

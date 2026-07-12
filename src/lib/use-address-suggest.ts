"use client";

import { useRef, useState } from "react";

/* HERE autosuggest логика — споделена между dashboard и storefront варианта.
   .trim() на ключа: env стойност с trailing newline → %0A → "Illegal API key id". */
const HERE_API_KEY = (process.env.NEXT_PUBLIC_HERE_API_KEY ?? "").trim();

export interface AddressSuggestion {
  id: string;
  title: string;
  resultType: string;
  address?: { label?: string; city?: string; district?: string; county?: string };
}

export interface AddressResult {
  fullAddress: string;
  city: string;
}

export function resolveCity(suggestion: AddressSuggestion): string {
  const addr = suggestion.address;
  const direct = addr?.city || addr?.district || addr?.county;
  if (direct) return direct;
  if (addr?.label) {
    /* HERE label: "ул. Х 25, 4004 Пловдив, България" — градът е предпоследната част. */
    const parts = addr.label.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const cityPart = parts[parts.length - 2]!.replace(/^\d+\s*/, "");
      if (cityPart) return cityPart;
    }
  }
  return "";
}

export function useAddressSuggest() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function clear() {
    setSuggestions([]);
  }

  function query(text: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3 || !HERE_API_KEY) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: text,
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
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  return { suggestions, loading, query, clear };
}

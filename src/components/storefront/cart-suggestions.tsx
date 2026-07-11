"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCartSuggestions, type SuggestionCard } from "@/actions/cart";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

interface CartSuggestionsProps {
  slug: string;
  base: string;
  productIds: string[];
  onNavigate?: () => void;
}

/** „Може да ти хареса" — cross-sell лента под редовете на количката. */
export function CartSuggestions({ slug, base, productIds, onNavigate }: CartSuggestionsProps) {
  const [items, setItems] = useState<SuggestionCard[]>([]);
  const idsKey = productIds.join(",");

  useEffect(() => {
    /* CartSuggestions се монтира само при непразна количка; при празен набор
       просто не зареждаме (без синхронен setState в effect — react-compiler гоч). */
    if (productIds.length === 0) return;
    let cancelled = false;
    getCartSuggestions(slug, productIds).then((r) => {
      if (!cancelled) setItems(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, idsKey]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-(--sf-text)">Може да ти хареса</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`${base}/p/${p.slug}`}
            onClick={onNavigate}
            className="flex w-28 shrink-0 flex-col gap-1.5"
          >
            <span className="relative aspect-square overflow-hidden rounded-(--sf-radius) bg-(--sf-surface)">
              {p.imagePath && (
                <Image
                  src={publicImageUrl(p.imagePath)}
                  alt={p.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              )}
            </span>
            <span className="truncate text-xs font-medium text-(--sf-text)">{p.name}</span>
            <span className="text-xs font-bold text-(--sf-text)">
              {formatPrice(p.promoPriceCents ?? p.priceCents)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

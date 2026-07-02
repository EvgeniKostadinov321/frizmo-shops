"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { priceCartAction, type CartLineView } from "@/actions/cart";
import { formatPrice } from "@/lib/money";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  onCartChange,
  removeFromCart,
  setCartQty,
} from "@/lib/cart-storage";
import type { PricedCart } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/storage";

const LINE_ERROR_LABELS: Record<string, string> = {
  not_found: "Продуктът вече не съществува",
  inactive: "Продуктът вече не се предлага",
  variant_missing: "Този вариант вече не се предлага",
  out_of_stock: "Изчерпан",
  insufficient_stock: "Няма достатъчно наличност",
  invalid_qty: "Невалидно количество",
};

interface CartViewProps {
  shopId: string;
  slug: string;
  base: string;
}

interface PricedState {
  forKey: string;
  cart: PricedCart | null;
  views: CartLineView[];
  error: string | null;
}

export function CartView({ shopId, slug, base }: CartViewProps) {
  const stored = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );
  const storedKey = JSON.stringify(stored);
  const [priced, setPriced] = useState<PricedState | null>(null);

  useEffect(() => {
    if (stored.length === 0) return;
    let cancelled = false;
    priceCartAction(slug, stored).then((result) => {
      if (cancelled) return;
      setPriced(
        result.ok
          ? { forKey: storedKey, cart: result.data.cart, views: result.data.views, error: null }
          : { forKey: storedKey, cart: null, views: [], error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, storedKey]);

  if (stored.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span aria-hidden className="text-5xl">
          🛒
        </span>
        <p className="text-(--sf-muted)">Количката ти е празна.</p>
        <Link
          href={`${base}/products`}
          className="inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-5 font-medium text-white transition-opacity hover:opacity-90"
        >
          Към продуктите
        </Link>
      </div>
    );
  }

  if (!priced || priced.forKey !== storedKey) {
    return <p className="py-16 text-center text-(--sf-muted)">Зареждане на количката...</p>;
  }

  if (priced.error || !priced.cart) {
    return <p className="py-16 text-center text-(--sf-muted)">{priced.error ?? "Грешка."}</p>;
  }

  const { cart, views } = priced;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {cart.lines.map((line, i) => {
          const storedLine = stored[i]!;
          const view = views[i];
          return (
            <div
              key={`${line.productId}-${line.variantKey ?? ""}`}
              className={`flex gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-3 ${
                line.error ? "opacity-80" : ""
              }`}
            >
              <Link
                href={view?.productSlug ? `${base}/p/${view.productSlug}` : base}
                className="relative size-20 shrink-0 overflow-hidden rounded-(--sf-radius) bg-(--sf-bg)"
              >
                {view?.imagePath ? (
                  <Image
                    src={publicImageUrl(view.imagePath)}
                    alt={line.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-2xl" aria-hidden>
                    📦
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate font-medium text-(--sf-text)">
                  {line.productName || "Недостъпен продукт"}
                </p>
                {line.variantLabel && (
                  <p className="text-xs text-(--sf-muted)">{line.variantLabel}</p>
                )}
                {line.appliedDeal && (
                  <p className="text-xs font-medium text-(--sf-accent)">🏷 {line.appliedDeal}</p>
                )}
                {line.error && (
                  <p className="text-xs font-medium text-(--sf-accent)">
                    {LINE_ERROR_LABELS[line.error]}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-(--sf-radius) border border-(--sf-border)">
                    <button
                      type="button"
                      aria-label="Намали"
                      onClick={() => setCartQty(shopId, storedLine, storedLine.qty - 1)}
                      className="flex size-9 items-center justify-center text-(--sf-text) hover:opacity-70"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-medium text-(--sf-text)">
                      {storedLine.qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Увеличи"
                      onClick={() => setCartQty(shopId, storedLine, storedLine.qty + 1)}
                      className="flex size-9 items-center justify-center text-(--sf-text) hover:opacity-70"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {!line.error && (
                      <span className="font-bold text-(--sf-text)">
                        {formatPrice(line.lineTotalCents)}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Премахни от количката"
                      onClick={() => removeFromCart(shopId, storedLine)}
                      className="text-(--sf-muted) hover:opacity-70"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4">
        <div className="flex justify-between text-(--sf-text)">
          <span>Междинна сума</span>
          <span className="font-bold">{formatPrice(cart.subtotalCents)}</span>
        </div>
        <p className="text-xs text-(--sf-muted)">
          Доставката се избира при завършване на поръчката.
        </p>
        {cart.hasErrors ? (
          <p className="text-sm font-medium text-(--sf-accent)">
            Премахни недостъпните продукти, за да продължиш.
          </p>
        ) : (
          <Link
            href={`${base}/checkout`}
            className="inline-flex h-12 items-center justify-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-white transition-opacity hover:opacity-90"
          >
            Завърши поръчката
          </Link>
        )}
      </div>
    </div>
  );
}

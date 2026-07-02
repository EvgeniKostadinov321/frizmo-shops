"use client";

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { ProductOption, ProductVariant } from "@/db";
import {
  addToCart,
  getCartSnapshot,
  getServerCartSnapshot,
  onCartChange,
} from "@/lib/cart-storage";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";
import { variantKey } from "@/lib/variants";

interface VariantPickerProps {
  shopId: string;
  productId: string;
  productName: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  baseStock: number | null;
  images: string[];
  options: ProductOption[];
  variants: ProductVariant[];
  /** Промоция „купи N за X" — показва се като бадж. */
  deal: { quantity: number; totalPriceCents: number } | null;
}

/**
 * Галерия + избор на вариант: изборът сменя цената, наличността и подрежда
 * вариантните снимки първи. В План 4 тук идва и "Добави в количката".
 */
export function VariantPicker({
  shopId,
  productId,
  productName,
  basePriceCents,
  promoPriceCents,
  baseStock,
  images,
  options,
  variants,
  deal,
}: VariantPickerProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);

  const selectedVariant = useMemo(() => {
    if (options.length === 0 || Object.keys(selection).length !== options.length) return null;
    const key = variantKey(selection);
    return variants.find((v) => variantKey(v.options) === key) ?? null;
  }, [selection, options.length, variants]);

  const priceCents = selectedVariant?.priceCents ?? basePriceCents;
  const stock = selectedVariant ? selectedVariant.stock : baseStock;
  const outOfStock = stock !== null && stock <= 0;
  const showPromo = promoPriceCents !== null && selectedVariant?.priceCents == null;

  /* Оставащата наличност е жива: наличност − каквото вече е в количката. */
  const cartLines = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );
  const currentVariantKey = selectedVariant ? variantKey(selectedVariant.options) : null;
  const inCart =
    cartLines.find((l) => l.productId === productId && l.variantKey === currentVariantKey)
      ?.qty ?? 0;
  const remaining = stock === null ? null : Math.max(0, stock - inCart);
  const allInCart = !outOfStock && remaining !== null && remaining <= 0;
  const effectiveQty = remaining === null ? qty : Math.min(qty, Math.max(1, remaining));

  const orderedImages = useMemo(() => {
    const variantImages = selectedVariant?.imagePaths ?? [];
    if (variantImages.length === 0) return images;
    const rest = images.filter((p) => !variantImages.includes(p));
    return [...variantImages, ...rest];
  }, [images, selectedVariant]);

  const currentImage = orderedImages[Math.min(activeImage, orderedImages.length - 1)];

  function select(optionName: string, value: string) {
    setSelection((prev) => ({ ...prev, [optionName]: value }));
    setActiveImage(0);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface)">
          {currentImage ? (
            <Image
              src={publicImageUrl(currentImage)}
              alt={productName}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <span className="flex size-full items-center justify-center text-6xl" aria-hidden>
              📦
            </span>
          )}
        </div>
        {orderedImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {orderedImages.map((path, i) => (
              <button
                key={path}
                type="button"
                aria-label={`Снимка ${i + 1}`}
                onClick={() => setActiveImage(i)}
                className={`relative size-16 shrink-0 overflow-hidden rounded-(--sf-radius) border-2 transition-colors ${
                  i === activeImage ? "border-(--sf-primary)" : "border-(--sf-border) opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={publicImageUrl(path)} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-3xl font-bold text-(--sf-primary)">
          {showPromo ? (
            <>
              {formatPrice(promoPriceCents)}{" "}
              <s className="text-lg font-normal text-(--sf-muted)">{formatPrice(priceCents)}</s>
            </>
          ) : (
            formatPrice(priceCents)
          )}
        </p>

        {options.map((option) => (
          <fieldset key={option.id}>
            <legend className="mb-2 text-sm font-medium text-(--sf-text)">{option.name}</legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selection[option.name] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => select(option.name, value)}
                    className={`flex h-10 items-center rounded-(--sf-radius) border px-4 text-sm transition-colors ${
                      active
                        ? "border-(--sf-primary) bg-(--sf-primary) text-white"
                        : "border-(--sf-border) text-(--sf-text) hover:border-(--sf-primary)"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {options.length > 0 && !selectedVariant && (
          <p className="text-sm text-(--sf-muted)">Избери {options.map((o) => o.name.toLowerCase()).join(" и ")}.</p>
        )}

        {outOfStock ? (
          <p className="font-medium text-(--sf-muted)">Изчерпано</p>
        ) : allInCart ? (
          <p className="text-sm font-medium text-(--sf-accent)">
            Цялата наличност е в количката ти.
          </p>
        ) : remaining !== null && remaining <= 5 ? (
          <p className="text-sm text-(--sf-accent)" aria-live="polite">
            {inCart > 0 ? `Можеш да добавиш още ${remaining} бр.` : `Остават само ${remaining} бр.`}
          </p>
        ) : null}

        {deal && (
          <p className="rounded-(--sf-radius) bg-(--sf-surface) px-3 py-2 text-sm font-medium text-(--sf-accent)">
            🏷 Купи {deal.quantity} бр за общо {formatPrice(deal.totalPriceCents)}
          </p>
        )}

        {!outOfStock && !allInCart && (
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-(--sf-radius) border border-(--sf-border)">
              <button
                type="button"
                aria-label="Намали количеството"
                onClick={() => setQty(Math.max(1, effectiveQty - 1))}
                className="flex size-11 items-center justify-center text-(--sf-text) hover:opacity-70"
              >
                −
              </button>
              <span aria-live="polite" className="w-8 text-center font-medium text-(--sf-text)">
                {effectiveQty}
              </span>
              <button
                type="button"
                aria-label="Увеличи количеството"
                disabled={remaining !== null && effectiveQty >= remaining}
                onClick={() => setQty(Math.min(remaining ?? 999, effectiveQty + 1))}
                className="flex size-11 items-center justify-center text-(--sf-text) hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={options.length > 0 && !selectedVariant}
              onClick={() => {
                addToCart(shopId, {
                  productId,
                  variantKey: currentVariantKey,
                  qty: effectiveQty,
                });
                setQty(1);
                toast.success("Добавено в количката.");
              }}
              className="h-12 flex-1 rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Добави в количката
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

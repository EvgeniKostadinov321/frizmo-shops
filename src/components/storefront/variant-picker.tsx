"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ProductOption, ProductVariant } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";
import { variantKey } from "@/lib/variants";

interface VariantPickerProps {
  productName: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  baseStock: number | null;
  images: string[];
  options: ProductOption[];
  variants: ProductVariant[];
}

/**
 * Галерия + избор на вариант: изборът сменя цената, наличността и подрежда
 * вариантните снимки първи. В План 4 тук идва и "Добави в количката".
 */
export function VariantPicker({
  productName,
  basePriceCents,
  promoPriceCents,
  baseStock,
  images,
  options,
  variants,
}: VariantPickerProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState(0);

  const selectedVariant = useMemo(() => {
    if (options.length === 0 || Object.keys(selection).length !== options.length) return null;
    const key = variantKey(selection);
    return variants.find((v) => variantKey(v.options) === key) ?? null;
  }, [selection, options.length, variants]);

  const priceCents = selectedVariant?.priceCents ?? basePriceCents;
  const stock = selectedVariant ? selectedVariant.stock : baseStock;
  const outOfStock = stock !== null && stock <= 0;
  const showPromo = promoPriceCents !== null && selectedVariant?.priceCents == null;

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
        ) : stock !== null && stock <= 5 ? (
          <p className="text-sm text-(--sf-accent)">Остават само {stock} бр.</p>
        ) : null}
      </div>
    </div>
  );
}
